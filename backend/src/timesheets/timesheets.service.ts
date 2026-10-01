import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateWeeklyTimesheetDto, CreateTimesheetEntryDto } from './dto/create-weekly-timesheet.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { UpdateTimesheetEntryDto } from './dto/update-timesheet-entry.dto';
import { buildEffortStatus, resolveEstimateHours } from './effort-status.util';
import { QueryTeamSummaryDto } from './dto/query-team-summary.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EmploymentStatus, ProjectType, TimesheetTaskType, TimesheetStatus, NotificationType, ProjectStatus } from '@prisma/client';
import { ScopeResolverService } from '../common/scope-resolver.service';
import { TIMESHEET_CATALOG } from './constants/timesheet-catalog';
import { AdminConfigService } from '../admin-config/admin-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../projects/projects.service';
import { AttendanceService } from '../attendance/attendance.service';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import dayjs from 'dayjs';

@Injectable()
export class TimesheetsService {
  private readonly submittedOrApprovedStatuses: TimesheetStatus[] = [
    TimesheetStatus.SUBMITTED,
    TimesheetStatus.RA_APPROVED,
    TimesheetStatus.PM_APPROVED,
  ];

  private readonly logger = new Logger(TimesheetsService.name);

  constructor(
    private prisma: PrismaService,
    private adminConfigService: AdminConfigService,
    private notificationsService: NotificationsService,
    private scopeResolver: ScopeResolverService,
    private projectsService: ProjectsService,
    private attendanceService: AttendanceService,
  ) {}

  private isAssignedToTask(task: { assigneeId: string | null; taskAssignees?: { userId: string }[] }, userId: string | null): boolean {
    return task.assigneeId === userId || (!!userId && !!task.taskAssignees?.some((a) => a.userId === userId));
  }

  private isAssignedToTicket(ticket: { assigneeId: string | null; ticketAssignees?: { userId: string }[] }, userId: string | null): boolean {
    return ticket.assigneeId === userId || (!!userId && !!ticket.ticketAssignees?.some((a) => a.userId === userId));
  }

  private parseDateParam(value: string | undefined, name: string) {
    if (!value) return undefined;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${name}`);
    }

    return parsed;
  }

  async getSettings() {
    let backdatedDaysLimit = 7;
    try {
      const configuredLimit = await this.adminConfigService.getNumber('timesheet.backdated_days_limit');
      if (Number.isFinite(configuredLimit) && configuredLimit >= 0) {
        backdatedDaysLimit = Math.floor(configuredLimit);
      }
    } catch {
      // Keep the standard fallback if the optional admin config row is absent or invalid.
    }

    // Threshold below which a working day counts as a shortfall in the calendar.
    let minDailyHours = 7;
    try {
      const configuredMin = await this.adminConfigService.getNumber('timesheet.min_daily_hours');
      if (Number.isFinite(configuredMin) && configuredMin >= 0) {
        minDailyHours = configuredMin;
      }
    } catch {
      // Keep the standard fallback if the optional admin config row is absent or invalid.
    }

    return { backdatedDaysLimit, minDailyHours };
  }

  /**
   * Enforce the admin-configured creation window on the server so it applies to
   * every role and cannot be bypassed by calling the API directly. Mirrors the
   * frontend picker: any week whose Monday falls within the last
   * `timesheet.backdated_days_limit` days (up to next week) is allowed.
   */
  private async assertWithinCreationWindow(startDateInput: string | Date) {
    const { backdatedDaysLimit } = await this.getSettings();

    const mondayOf = (d: dayjs.Dayjs) => {
      const dow = d.day(); // 0 = Sunday … 6 = Saturday
      return d.add(dow === 0 ? -6 : 1 - dow, 'day').startOf('day');
    };

    const today = dayjs().startOf('day');
    const requestedMonday = mondayOf(dayjs(startDateInput));
    const earliestMonday = mondayOf(today.subtract(backdatedDaysLimit, 'day'));
    const latestMonday = mondayOf(today).add(7, 'day'); // next week's Monday

    if (requestedMonday.isBefore(earliestMonday)) {
      throw new BadRequestException(
        `Timesheets can only be created for weeks within the last ${backdatedDaysLimit} day(s). Older weeks require administrator approval.`,
      );
    }
    if (requestedMonday.isAfter(latestMonday)) {
      throw new BadRequestException('Timesheets cannot be created more than one week in advance.');
    }
  }

  async getOrCreateWeekly(dto: CreateWeeklyTimesheetDto) {
    await this.assertWithinCreationWindow(dto.startDate);

    const timesheet = await this.prisma.timesheet.findUnique({
      where: {
        user_week: {
          userId: dto.userId,
          startDate: new Date(dto.startDate),
        },
      },
      include: { entries: true },
    });

    if (timesheet) return timesheet;

    return this.prisma.timesheet.create({
      data: {
        userId: dto.userId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: TimesheetStatus.DRAFT,
      },
      include: { entries: true },
    });
  }

  async addEntry(timesheetId: string, entryDto: CreateTimesheetEntryDto, actorRole: string, actorId?: string, bulkUploadBatchId?: string) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id: timesheetId },
    });

    if (!timesheet) {
      throw new NotFoundException(`Timesheet with ID ${timesheetId} not found`);
    }

    if (timesheet.status !== TimesheetStatus.DRAFT && timesheet.status !== TimesheetStatus.REJECTED) {
      throw new BadRequestException('Cannot add entries to a submitted or approved timesheet');
    }

    const entryDate = new Date(entryDto.date);

    // 1. Future date restriction
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (entryDate > today) {
      throw new BadRequestException('Timesheet entries cannot be logged for future dates');
    }

    // 2. Closed period lock
    const month = entryDate.getMonth() + 1;
    const year = entryDate.getFullYear();
    const lockPeriod = await this.prisma.timesheetLockPeriod.findUnique({
      where: { month_year: { month, year } },
    });
    if (lockPeriod?.isLocked) {
      throw new BadRequestException(`Timesheet period ${month}-${year} is locked by Finance`);
    }

    // 3. Backdated entry approval workflow (employee timesheets only)
    if (timesheet.userId) {
      const backdatedLimit = await this.adminConfigService.getNumber('timesheet.backdated_days_limit');
      const daysDiff = dayjs().diff(dayjs(entryDate), 'day');
      if (daysDiff > backdatedLimit) {
        await this.prisma.backdatedTimesheetRequest.create({
          data: {
            timesheetId,
            entryDate,
            userId: timesheet.userId,
            reason: entryDto.reason ?? '',
          },
        });
        throw new BadRequestException(
          `Entry is backdated > ${backdatedLimit} days. A request has been submitted for approval.`,
        );
      }
    }

    // 3.5 Check-in requirement (employee timesheets only — also enforced for bulk-fill rows)
    if (timesheet.userId) {
      const checkedIn = await this.attendanceService.hasCheckedIn(timesheet.userId, entryDate, entryDto.timeZone);
      if (!checkedIn) {
        throw new BadRequestException('Please clock in before filling the timesheet.');
      }
    }

    // 4. Leave Integration Check (only for employee timesheets)
    if (timesheet.userId) {
      const leave = await this.prisma.leave.findFirst({
        where: {
          userId: timesheet.userId,
          status: 'APPROVED',
          startDate: { lte: entryDate },
          endDate: { gte: entryDate },
        },
      });

      if (leave) {
        throw new BadRequestException(`User is on leave on ${entryDate.toDateString()}`);
      }
    }

    // 5. Per-entry hours cap: a single entry cannot exceed 4 hours
    if (entryDto.hours > 4) {
      throw new BadRequestException('A single timesheet entry cannot exceed 4 hours. Please split into multiple entries.');
    }

    // 6. Overlap check (if times are provided)
    if (entryDto.startTime && entryDto.endTime) {
      const start = new Date(entryDto.startTime);
      const end = new Date(entryDto.endTime);

      const overlap = await this.prisma.timesheetEntry.findFirst({
        where: {
          timesheet: { userId: timesheet.userId },
          date: entryDate,
          OR: [
            { startTime: { lte: start }, endTime: { gt: start } },
            { startTime: { lt: end }, endTime: { gte: end } },
            { startTime: { gte: start }, endTime: { lte: end } },
          ],
        },
      });

      if (overlap) {
        throw new BadRequestException('Overlapping timesheet entry detected');
      }
    }

    // 7. Project and Assignment Enforcement
    const project = await this.prisma.project.findUnique({ where: { id: entryDto.projectId } });
    if (!project) {
      throw new BadRequestException('Selected project does not exist');
    }

    let derivedTaskType: TimesheetTaskType = entryDto.taskType ?? TimesheetTaskType.OBSERVATION;

    if (entryDto.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: entryDto.taskId },
        include: {
          taskTypeMaster: { select: { name: true } },
          taskAssignees: { select: { userId: true } },
        },
      });
      if (!task) {
        throw new BadRequestException('Selected task does not exist');
      }
      if (task.projectId !== entryDto.projectId) {
        throw new BadRequestException('Selected task does not belong to the selected project');
      }
      if (!this.isAssignedToTask(task, timesheet.userId) && !['ADMIN', 'PM', 'TL'].includes(actorRole)) {
        throw new BadRequestException('Cannot log hours for a task not assigned to you');
      }
      if ((task as any).taskTypeMaster?.name) {
        const typeName = (task as any).taskTypeMaster.name.toUpperCase().replace(/[\s-]/g, '_');
        derivedTaskType = typeName === 'CHANGE_REQUEST' ? TimesheetTaskType.CHANGE_REQUEST : TimesheetTaskType.OBSERVATION;
      }
    }
    if (entryDto.ticketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: entryDto.ticketId },
        include: { ticketAssignees: { select: { userId: true } } },
      });
      if (!ticket) {
        throw new BadRequestException('Selected ticket does not exist');
      }
      if (ticket.projectId !== entryDto.projectId) {
        throw new BadRequestException('Selected ticket does not belong to the selected project');
      }
      if (!this.isAssignedToTicket(ticket, timesheet.userId) && !['ADMIN', 'PM', 'TL'].includes(actorRole)) {
        throw new BadRequestException('Cannot log hours for a ticket not assigned to you');
      }
    }

    // 8. Activity / Sub-Activity Validation
    let activityMasterId: string | undefined;
    let taskSubActivityMasterId: string | undefined;

    if (entryDto.taskSubActivityMasterId) {
      // New path: validate against TaskSubActivityMaster
      const sub = await this.prisma.taskSubActivityMaster.findUnique({
        where: { id: entryDto.taskSubActivityMasterId },
      });
      if (!sub || !sub.isActive) {
        throw new BadRequestException('Invalid or inactive sub-activity selection');
      }
      taskSubActivityMasterId = sub.id;
    } else if (entryDto.activityMasterId) {
      // Legacy path: validate against TimesheetActivityMaster by ID
      const am = await this.prisma.timesheetActivityMaster.findUnique({
        where: { id: entryDto.activityMasterId },
      });
      if (!am) throw new BadRequestException('Invalid activity master selection');
      activityMasterId = am.id;
    } else if (entryDto.activity && entryDto.subActivity) {
      // Legacy path: look up by (taskType, activity, subActivity) triplet
      const am = await this.prisma.timesheetActivityMaster.findFirst({
        where: {
          taskType: entryDto.taskType,
          activity: entryDto.activity,
          subActivity: entryDto.subActivity,
        },
      });
      if (!am) throw new BadRequestException('Invalid Activity or Sub-Activity selection');
      activityMasterId = am.id;
    } else {
      throw new BadRequestException('Activity selection is required');
    }

    const entry = await this.prisma.timesheetEntry.create({
      data: {
        timesheetId,
        projectId: entryDto.projectId,
        date: entryDate,
        hours: entryDto.hours,
        description: entryDto.description,
        taskType: derivedTaskType,
        activityMasterId: activityMasterId ?? null,
        taskSubActivityMasterId: taskSubActivityMasterId ?? null,
        taskId: entryDto.taskId,
        ticketId: entryDto.ticketId,
        bulkUploadBatchId: bulkUploadBatchId ?? null,
      },
    });

    // Fresh timesheet activity revives a project the dormancy cron had auto-inactivated.
    if (project.status === ProjectStatus.INACTIVE) {
      await this.projectsService.systemTransition(project.id, ProjectStatus.ACTIVE, {
        actorId: actorId ?? null,
        reason: 'Timesheet activity resumed',
        notifyPm: false,
      });
    }

    // Soft over-estimate warning. Never blocks the save — the entry is always
    // written; the caller (entry form, edit dialog, bulk fill) surfaces the text.
    let effortWarning: string | null = null;
    if (entryDto.taskId) {
      try {
        const status = await this.getTaskEffortStatus(entryDto.taskId, {
          incomingHours: entryDto.hours,
        });
        effortWarning = status.warning;
        if (effortWarning) {
          this.logger.warn(`Timesheet entry on task ${entryDto.taskId} is over estimate — ${effortWarning}`);
        }
      } catch (error) {
        // A warning must never fail the entry that was just saved.
        this.logger.error('Over-estimate check failed', error);
      }
    }

    return { ...entry, effortWarning };
  }

  /**
   * Estimate vs logged hours for one task — powers the over-run warning in the
   * timesheet entry form, the edit dialog and the bulk-fill report.
   *
   * `loggedHours` sums every TimesheetEntry against the task across all
   * timesheets, not just the current week: the estimate covers the whole task,
   * so the comparison has to as well. (`Task.actualEffort` is no use here — it is
   * only incremented at PM approval, so it lags the in-progress week.) Pass
   * `excludeEntryId` when editing so the entry being changed isn't counted twice.
   */
  async getTaskEffortStatus(
    taskId: string,
    options: { incomingHours?: number; excludeEntryId?: string } = {},
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, plannedHours: true, estimatedEffort: true },
    });
    if (!task) {
      throw new NotFoundException('Selected task does not exist');
    }

    const aggregate = await this.prisma.timesheetEntry.aggregate({
      where: {
        taskId,
        ...(options.excludeEntryId ? { NOT: { id: options.excludeEntryId } } : {}),
      },
      _sum: { hours: true },
    });

    return {
      taskId: task.id,
      ...buildEffortStatus({
        taskTitle: task.title,
        estimateHours: resolveEstimateHours(task),
        loggedHours: aggregate._sum.hours ?? 0,
        incomingHours: options.incomingHours,
      }),
    };
  }

  // ── Bulk Fill (Excel template download + upload) ──────────────────────────

  /**
   * Scoped, per-user data a person can log against. Reused by both the template
   * generator (to build the cascading dropdowns) and the upload parser (to resolve
   * labels back to ids), so dropdown values and import resolution stay in lock-step.
   *
   * Each task carries its resolved task type (own `taskTypeMasterId`, else its
   * parent task's — one level, mirroring the on-screen entry form). The task-type
   * tree drives the Task→Activity→Sub-Activity cascade.
   */
  private async getBulkFillScope(user: { id: string; role: string }) {
    const projectWhere: any = {};
    if (user.role !== 'ADMIN') {
      projectWhere.OR = [
        { pmId: user.id },
        { createdById: user.id },
        { allocations: { some: { userId: user.id } } },
      ];
    }
    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, projectCode: true },
      orderBy: { name: 'asc' },
    });
    const projectIds = projects.map((p) => p.id);

    // Only the user's own assigned tasks — this also enforces "log only for tasks
    // assigned to you" at resolution time (a row citing someone else's task won't match).
    const rawTasks = projectIds.length
      ? await this.prisma.task.findMany({
          where: {
            projectId: { in: projectIds },
            OR: [{ assigneeId: user.id }, { taskAssignees: { some: { userId: user.id } } }],
          },
          select: {
            id: true,
            title: true,
            projectId: true,
            taskTypeMasterId: true,
            parent: { select: { taskTypeMasterId: true } },
          },
          orderBy: { title: 'asc' },
        })
      : [];
    const tasks = rawTasks.map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      typeId: t.taskTypeMasterId ?? t.parent?.taskTypeMasterId ?? null,
    }));

    // Active task-type tree → activity / sub-activity lookup maps (active-only at
    // every level, matching task-type-master.service.getTree()).
    const tree = await this.prisma.taskTypeMaster.findMany({
      where: { isActive: true },
      select: {
        id: true,
        activities: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            subActivities: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    const activitiesByType = new Map<string, { id: string; name: string }[]>();
    const subsByActivity = new Map<string, { id: string; name: string }[]>();
    const subActivities: { id: string; name: string }[] = [];
    for (const tt of tree) {
      activitiesByType.set(tt.id, tt.activities.map((a) => ({ id: a.id, name: a.name })));
      for (const a of tt.activities) {
        subsByActivity.set(a.id, a.subActivities.map((s) => ({ id: s.id, name: s.name })));
        subActivities.push(...a.subActivities.map((s) => ({ id: s.id, name: s.name })));
      }
    }

    return { projects, tasks, activitiesByType, subsByActivity, subActivities };
  }

  async generateBulkTemplate(user: { id: string; role: string }): Promise<Buffer> {
    const { backdatedDaysLimit } = await this.getSettings();
    const { projects, tasks, activitiesByType, subsByActivity } = await this.getBulkFillScope(user);

    // Labels carry a short id suffix so (a) the importer resolves them unambiguously
    // and (b) the cascade's MATCH is exact — project/task/activity/sub names are not
    // globally unique. The suffix is id.slice(0,8), parsed back on import by startsWith.
    const nameCounts = new Map<string, number>();
    projects.forEach((p) => {
      const k = (p.name ?? '').trim().toLowerCase();
      nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
    });
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const projectDisplay = (p: { id: string; name: string; projectCode: string | null }) => {
      const isDup = (nameCounts.get((p.name ?? '').trim().toLowerCase()) ?? 0) > 1;
      return isDup ? `${p.name} [${p.projectCode?.trim() || p.id.slice(0, 8)}]` : p.name;
    };
    const taskDisplay = (t: { id: string; title: string; projectId: string }) => {
      const projName = projectById.get(t.projectId)?.name ?? '';
      return `${t.title}${projName ? ` (${projName})` : ''} [${t.id.slice(0, 8)}]`;
    };
    const activityDisplay = (a: { id: string; name: string }) => `${a.name} [${a.id.slice(0, 8)}]`;
    const subDisplay = (s: { id: string; name: string }) => `${s.name} [${s.id.slice(0, 8)}]`;

    // Flat MATCH lists (order MUST match the matrix named-range order built below).
    const projectNames = projects.map(projectDisplay).filter(Boolean) as string[];
    const taskLabels = tasks.map(taskDisplay);
    // Distinct activities reachable from the user's tasks' task types (first-seen order).
    const activityById = new Map<string, { id: string; name: string }>();
    for (const t of tasks) {
      if (!t.typeId) continue;
      for (const a of activitiesByType.get(t.typeId) ?? []) {
        if (!activityById.has(a.id)) activityById.set(a.id, a);
      }
    }
    const allActivities = [...activityById.values()];
    const activityLabels = allActivities.map(activityDisplay);
    const hoursValues = Array.from({ length: 24 }, (_, i) => i);           // 0..23
    const minuteValues = Array.from({ length: 12 }, (_, i) => i * 5);      // 0,5,..,55

    const BRAND = 'FF1F3A5F';
    const BRAND_DARK = 'FF14243B';
    const BASE_FONT = { name: 'Calibri', size: 11 } as const;

    const COLUMNS = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Project', key: 'project', width: 30 },
      { header: 'Task', key: 'task', width: 40 },
      { header: 'Activity', key: 'activity', width: 30 },
      { header: 'Sub-Activity', key: 'subactivity', width: 30 },
      { header: 'Hours', key: 'hours', width: 9 },
      { header: 'Minutes', key: 'minutes', width: 9 },
      { header: 'Description', key: 'description', width: 40 },
    ];
    const requiredKeys = new Set(['date', 'project', 'task', 'activity', 'subactivity', 'hours']);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Newel Planner';

    const sheet = workbook.addWorksheet('Entries', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = COLUMNS.map((c) => ({
      header: c.header + (requiredKeys.has(c.key) ? ' *' : ''),
      key: c.key,
      width: c.width,
      style: { font: { ...BASE_FONT } },
    }));
    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      cell.font = { ...BASE_FONT, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = { bottom: { style: 'thin', color: { argb: BRAND_DARK } } };
    });
    sheet.getColumn('date').numFmt = 'yyyy-mm-dd';

    // ── Hidden "Lists" sheet ───────────────────────────────────────────────
    // Cols A-E: flat lists (A/D/E feed plain dropdowns; B/C are MATCH targets for
    // the cascade). Then, after a spacer, three matrix blocks — one column per
    // parent — each registered as a tight defined name so INDIRECT can resolve it.
    const lists = workbook.addWorksheet('Lists', { state: 'hidden' });
    const flatCols: { title: string; values: (string | number)[] }[] = [
      { title: 'Projects', values: projectNames },       // A — Project dropdown + Task-cascade MATCH
      { title: 'AllTasks', values: taskLabels },         // B — Activity-cascade MATCH
      { title: 'AllActivities', values: activityLabels },// C — Sub-Activity-cascade MATCH
      { title: 'Hours', values: hoursValues },           // D
      { title: 'Minutes', values: minuteValues },        // E
    ];
    flatCols.forEach((lc, i) => {
      lists.getColumn(i + 1).width = 28;
      lists.getCell(1, i + 1).value = lc.title;
      lc.values.forEach((v, r) => (lists.getCell(r + 2, i + 1).value = v as any));
    });

    // Matrix blocks (register `prefix_1..prefix_n` in the SAME order as the flat list).
    let cursor = flatCols.length + 2; // leave a spacer column after the flat lists
    const addMatrix = (prefix: string, columns: { header: string; items: string[] }[]) => {
      columns.forEach((c, i) => {
        const colNum = cursor + i;
        lists.getColumn(colNum).width = 40;
        lists.getCell(1, colNum).value = c.header;
        c.items.forEach((v, r) => (lists.getCell(r + 2, colNum).value = v));
        const letter = lists.getColumn(colNum).letter;
        const lastRow = c.items.length > 0 ? c.items.length + 1 : 2;
        workbook.definedNames.add(`Lists!$${letter}$2:$${letter}$${lastRow}`, `${prefix}_${i + 1}`);
      });
      cursor += columns.length + 1; // +1 spacer between blocks
    };
    // tk_i = tasks of project i (order = projects/col A)
    addMatrix('tk', projects.map((p) => ({
      header: projectDisplay(p) ?? '',
      items: tasks.filter((t) => t.projectId === p.id).map(taskDisplay),
    })));
    // ac_j = activities of task j's task type (order = tasks/col B); empty if no type
    addMatrix('ac', tasks.map((t) => ({
      header: taskDisplay(t),
      items: (t.typeId ? activitiesByType.get(t.typeId) ?? [] : []).map(activityDisplay),
    })));
    // sa_k = sub-activities of activity k (order = allActivities/col C)
    addMatrix('sa', allActivities.map((a) => ({
      header: activityDisplay(a),
      items: (subsByActivity.get(a.id) ?? []).map(subDisplay),
    })));

    // ── Validations ────────────────────────────────────────────────────────
    const colLetter = (key: string) =>
      sheet.getColumn(COLUMNS.findIndex((c) => c.key === key) + 1).letter;
    const flatRange = (flatColIdx: number, count: number) => {
      const letter = lists.getColumn(flatColIdx).letter;
      return `Lists!$${letter}$2:$${letter}$${Math.max(count + 1, 2)}`;
    };
    const addPlainDropdown = (key: string, flatColIdx: number, count: number, error: string) => {
      const letter = colLetter(key);
      for (let r = 2; r <= 1000; r++) {
        sheet.getCell(`${letter}${r}`).dataValidation = {
          type: 'list', allowBlank: true, formulae: [flatRange(flatColIdx, count)],
          showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Value not in list', error,
        };
      }
    };
    // Cascading dropdown: options resolved from the parent cell in the same row via
    // INDIRECT("prefix_" & MATCH(parent, flatList, 0)). Works in Excel and WPS.
    const addCascade = (key: string, prefix: string, parentKey: string, matchColLetter: string, matchCount: number, error: string) => {
      const letter = colLetter(key);
      const parentLetter = colLetter(parentKey);
      const last = Math.max(matchCount + 1, 2);
      for (let r = 2; r <= 1000; r++) {
        const idx = `MATCH($${parentLetter}${r},Lists!$${matchColLetter}$2:$${matchColLetter}$${last},0)`;
        sheet.getCell(`${letter}${r}`).dataValidation = {
          type: 'list', allowBlank: true, formulae: [`INDIRECT("${prefix}_"&${idx})`],
          showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Value not in list', error,
        };
      }
    };

    addPlainDropdown('project', 1, projectNames.length, 'Pick a project from the dropdown.');
    addCascade('task', 'tk', 'project', 'A', projectNames.length,
      'Pick a Project first, then choose one of that project\'s tasks assigned to you.');
    addCascade('activity', 'ac', 'task', 'B', taskLabels.length,
      'Pick a Task first, then choose an activity for that task.');
    addCascade('subactivity', 'sa', 'activity', 'C', activityLabels.length,
      'Pick an Activity first, then choose a sub-activity.');
    addPlainDropdown('hours', 4, hoursValues.length, 'Hours must be a whole number between 0 and 23.');
    addPlainDropdown('minutes', 5, minuteValues.length, 'Minutes must be one of 0, 5, 10, …, 55.');

    // Date: within the admin-configured backdated window, up to today (no future).
    const earliest = dayjs().subtract(backdatedDaysLimit, 'day').startOf('day').toDate();
    const today = dayjs().endOf('day').toDate();
    const dateLetter = colLetter('date');
    for (let r = 2; r <= 1000; r++) {
      sheet.getCell(`${dateLetter}${r}`).dataValidation = {
        type: 'date', operator: 'between', allowBlank: true, formulae: [earliest, today],
        showInputMessage: true, promptTitle: 'Enter a date',
        prompt: `YYYY-MM-DD, within the last ${backdatedDaysLimit} day(s). Future dates are not allowed.`,
        showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Invalid date',
        error: `Date must be within the last ${backdatedDaysLimit} day(s) and not in the future.`,
      };
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Parse a filled bulk-fill template and create timesheet entries for the current
   * user. Reuses getOrCreateWeekly (enforces the admin-configured allowed-days
   * window) and addEntry (all per-entry validations), so nothing is bypassed.
   * Valid rows import even if others fail; returns a row-by-row report.
   */
  async bulkUploadEntries(
    file: Express.Multer.File,
    user: { id: string; role: string },
    timeZone?: string,
  ): Promise<{
    batchId: string;
    imported: number;
    skipped: number;
    errors: { row: number; message: string }[];
    /** Rows that imported fine but took the task over its estimate (soft). */
    warnings: { row: number; message: string }[];
  }> {
    const workbook = new ExcelJS.Workbook();
    try {
      if (file.originalname.toLowerCase().endsWith('.csv')) {
        const stream = new Readable();
        stream.push(file.buffer);
        stream.push(null);
        await workbook.csv.read(stream);
      } else {
        await (workbook.xlsx as any).load(file.buffer);
      }
    } catch {
      throw new BadRequestException('Could not parse file. Please upload a valid .xlsx or .csv file.');
    }

    const worksheet = workbook.getWorksheet('Entries') ?? workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File contains no worksheets.');

    const normalise = (s: unknown) => (s ?? '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const aliases: Record<string, string> = {
      date: 'date', project: 'project', task: 'task',
      activity: 'activity', subactivity: 'subactivity',
      hours: 'hours', hour: 'hours', minutes: 'minutes', minute: 'minutes',
      description: 'description', notes: 'description',
    };
    const headerRow = worksheet.getRow(1).values as any[];
    const colIndex: Record<string, number> = {};
    headerRow.forEach((h, i) => {
      if (!h) return;
      const key = normalise(h);
      colIndex[aliases[key] ?? key] = i;
    });
    for (const req of ['date', 'task', 'subactivity', 'hours']) {
      if (colIndex[req] === undefined) throw new BadRequestException(`Missing required column "${req}".`);
    }

    const cell = (row: ExcelJS.Row, key: string): string => {
      const idx = colIndex[key];
      if (idx === undefined) return '';
      const v = row.getCell(idx).value as any;
      if (v == null) return '';
      if (v instanceof Date) return v.toISOString().substring(0, 10);
      if (typeof v === 'object' && 'text' in v) return String(v.text).trim();
      if (typeof v === 'object' && 'result' in v) return String((v as any).result).trim();
      return String(v).trim();
    };

    // Resolution maps keyed by the short id suffix the template embeds in each label.
    const { projects, tasks, activitiesByType, subsByActivity, subActivities } =
      await this.getBulkFillScope(user);
    const taskByPrefix = new Map(tasks.map((t) => [t.id.slice(0, 8).toLowerCase(), t]));
    const subByPrefix = new Map(subActivities.map((s) => [s.id.slice(0, 8).toLowerCase(), s.id]));
    const parseIdSuffix = (raw: string): string | null => {
      const m = raw.match(/\[([^\]]+)\]\s*$/);
      return m ? m[1].trim().toLowerCase() : null;
    };

    // ── Name fallback ───────────────────────────────────────────────────────
    // Rows pasted or typed in (rather than picked from the dropdown) lose the
    // ` [id8]` tag. Fall back to matching the label text, but only when it is
    // unambiguous — an ambiguous name is reported, never guessed.
    const nameKey = (s: string) =>
      s.replace(/\s*\[[^\]]+\]\s*$/, '').trim().toLowerCase().replace(/\s+/g, ' ');
    const projectNameById = new Map(projects.map((p) => [p.id, p.name ?? '']));

    // A task is reachable by its full template label ("Title (Project)") and by its
    // bare title; ids are deduped per key so one task never looks ambiguous.
    const taskIdsByName = new Map<string, Set<string>>();
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    for (const t of tasks) {
      const projName = projectNameById.get(t.projectId) ?? '';
      for (const label of [`${t.title}${projName ? ` (${projName})` : ''}`, t.title]) {
        const k = nameKey(label);
        if (!taskIdsByName.has(k)) taskIdsByName.set(k, new Set());
        taskIdsByName.get(k)!.add(t.id);
      }
    }

    type ScopeTask = (typeof tasks)[number];
    const resolveTask = (raw: string): { task?: ScopeTask; error?: string } => {
      const suffix = parseIdSuffix(raw);
      if (suffix) {
        const t = taskByPrefix.get(suffix);
        return t
          ? { task: t }
          : { error: `Task "${raw}" not found or not assigned to you — re-download the template` };
      }
      const ids = [...(taskIdsByName.get(nameKey(raw)) ?? [])];
      if (ids.length === 1) return { task: taskById.get(ids[0])! };
      if (ids.length > 1)
        return {
          error: `Task "${raw}" matches ${ids.length} of your tasks — re-download the template and pick from the dropdown so the [id] tag is kept`,
        };
      return { error: `Task "${raw}" not found or not assigned to you — re-download the template` };
    };

    // Sub-Activity by name is scoped to the activities reachable from the task's
    // task type, and narrowed further by the row's Activity cell when that resolves —
    // sub-activity names repeat across activities, so the parent is what disambiguates.
    const resolveSub = (
      task: ScopeTask,
      activityRaw: string,
      subRaw: string,
    ): { subId?: string; error?: string } => {
      const suffix = parseIdSuffix(subRaw);
      if (suffix) {
        const id = subByPrefix.get(suffix);
        return id
          ? { subId: id }
          : { error: `Sub-Activity "${subRaw}" not found or inactive — re-download the template` };
      }

      const reachable = task.typeId ? activitiesByType.get(task.typeId) ?? [] : [];
      let candidates: { id: string; name: string }[];
      if (!reachable.length) {
        // Task has no task type → nothing to scope by; search the whole active master.
        candidates = subActivities;
      } else {
        let acts = reachable;
        if (activityRaw) {
          const aSuffix = parseIdSuffix(activityRaw);
          const narrowed = aSuffix
            ? reachable.filter((a) => a.id.slice(0, 8).toLowerCase() === aSuffix)
            : reachable.filter((a) => nameKey(a.name) === nameKey(activityRaw));
          if (narrowed.length) acts = narrowed;
        }
        candidates = acts.flatMap((a) => subsByActivity.get(a.id) ?? []);
      }

      const target = nameKey(subRaw);
      const hitIds = new Set(candidates.filter((s) => nameKey(s.name) === target).map((s) => s.id));
      if (hitIds.size === 1) return { subId: [...hitIds][0] };
      if (hitIds.size > 1)
        return {
          error: `Sub-Activity "${subRaw}" is ambiguous under Activity "${activityRaw || '—'}" — re-download the template and pick from the dropdown so the [id] tag is kept`,
        };
      return {
        error: `Sub-Activity "${subRaw}" not found or inactive for this task — re-download the template`,
      };
    };

    // One batch per upload. Every entry it creates and every week it newly creates
    // are tagged with this id, so the upload can later be rolled back precisely.
    const batch = await this.prisma.bulkUploadBatch.create({
      data: { userId: user.id, uploadedById: user.id, fileName: file.originalname ?? null },
      select: { id: true },
    });

    // Canonical calendar day (YYYY-MM-DD) of a raw date cell. The cell is already a
    // date-only string; format() keeps the calendar day without any timezone shift.
    const toYmd = (raw: string): string | null => {
      const d = dayjs(raw);
      return d.isValid() ? d.format('YYYY-MM-DD') : null;
    };
    // UTC midnight of a YYYY-MM-DD — the app's convention (matches the UI's
    // `new Date('YYYY-MM-DD')`), independent of the server's timezone.
    const utcDay = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

    // Resolve the weekly timesheet for a day. Reuse an existing week whose range
    // CONTAINS the day (offset-independent, so we never duplicate a week the UI,
    // a seed, or a prior upload already created); only create when none overlaps,
    // computing the Monday in UTC to match the frontend's convention.
    const weekCache = new Map<string, { id?: string; error?: string }>();
    const resolveWeek = async (ymd: string): Promise<{ id?: string; error?: string }> => {
      const day = utcDay(ymd);
      const dow = day.getUTCDay(); // 0 = Sun … 6 = Sat
      const monday = new Date(day);
      monday.setUTCDate(day.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
      const key = monday.toISOString().slice(0, 10);
      if (weekCache.has(key)) return weekCache.get(key)!;

      let res: { id?: string; error?: string };
      // Match an existing week for this calendar week regardless of the stored TZ
      // offset: its startDate lands within ±2 days of the computed Monday (legacy /
      // UI weeks are anchored at IST-midnight = the previous Sunday 18:30Z; weeks we
      // create use Monday 00:00Z). ±2 days can't collide with an adjacent week (7d apart).
      const lo = new Date(monday); lo.setUTCDate(monday.getUTCDate() - 2);
      const hi = new Date(monday); hi.setUTCDate(monday.getUTCDate() + 2);
      const existing = await this.prisma.timesheet.findFirst({
        where: { userId: user.id, startDate: { gte: lo, lte: hi } },
        orderBy: { startDate: 'asc' },
        select: { id: true },
      });
      if (existing) {
        // Reused, pre-existing week — NOT owned by this batch, so rollback never touches it.
        res = { id: existing.id };
      } else {
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        try {
          await this.assertWithinCreationWindow(monday.toISOString()); // admin backdated-days window
          const created = await this.prisma.timesheet.create({
            data: {
              userId: user.id,
              startDate: monday,
              endDate: sunday,
              status: TimesheetStatus.DRAFT,
              bulkUploadBatchId: batch.id, // week created by this upload → removable on rollback
            },
            select: { id: true },
          });
          res = { id: created.id };
        } catch (e: any) {
          res = { error: e?.message ?? 'Could not create the weekly timesheet for this date' };
        }
      }
      weekCache.set(key, res);
      return res;
    };

    // ── Dedup: skip a row whose (date + task + description) already exists ──────
    // Description is compared trimmed + case-insensitive. Seeded from existing DB
    // entries across the upload's date span, then extended per successful insert so
    // repeats within the same file are also caught.
    const normDesc = (d: string | null | undefined) => (d ?? '').trim().toLowerCase();
    const dedupKey = (ymd: string, taskId: string | null | undefined, desc: string | null | undefined) =>
      `${ymd}|${taskId ?? ''}|${normDesc(desc)}`;

    let minYmd: string | null = null;
    let maxYmd: string | null = null;
    for (let r = 2; r <= worksheet.rowCount; r++) {
      const ymd = toYmd(cell(worksheet.getRow(r), 'date'));
      if (!ymd) continue;
      if (!minYmd || ymd < minYmd) minYmd = ymd;
      if (!maxYmd || ymd > maxYmd) maxYmd = ymd;
    }

    const seen = new Set<string>();
    if (minYmd && maxYmd) {
      const upper = utcDay(maxYmd);
      upper.setUTCDate(upper.getUTCDate() + 1); // exclusive upper bound (day after max)
      const existingEntries = await this.prisma.timesheetEntry.findMany({
        where: {
          timesheet: { userId: user.id },
          date: { gte: utcDay(minYmd), lt: upper },
        },
        select: { date: true, taskId: true, description: true },
      });
      for (const e of existingEntries) {
        seen.add(dedupKey(e.date.toISOString().slice(0, 10), e.taskId, e.description));
      }
    }

    const errors: { row: number; message: string }[] = [];
    // Over-estimate warnings for rows that imported fine. Kept separate from
    // `errors` so imported/skipped counts and the batch's error total stay
    // truthful — and returned in the response only (BulkUploadBatch has no
    // warnings column, and the history grid is about failures).
    const warnings: { row: number; message: string }[] = [];
    let imported = 0;
    let skipped = 0;

    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const dateRaw = cell(row, 'date');
      const taskRaw = cell(row, 'task');
      const activityRaw = cell(row, 'activity');
      const subRaw = cell(row, 'subactivity');
      const hoursRaw = cell(row, 'hours');
      const minutesRaw = cell(row, 'minutes');
      const description = cell(row, 'description');

      // Silently skip fully blank rows.
      if (!dateRaw && !taskRaw && !activityRaw && !subRaw && !hoursRaw && !minutesRaw && !description)
        continue;

      const rowErrors: string[] = [];

      const ymd = toYmd(dateRaw);
      if (!ymd) rowErrors.push('Invalid or missing Date');

      let task: ScopeTask | undefined;
      if (!taskRaw) rowErrors.push('Missing Task');
      else {
        const r = resolveTask(taskRaw);
        task = r.task;
        if (!task) rowErrors.push(r.error!);
      }

      // Sub-Activity resolution needs the task (it scopes the name fallback), so it
      // only runs once the task resolved.
      let subId: string | undefined;
      if (!subRaw) rowErrors.push('Missing Sub-Activity');
      else if (task) {
        const r = resolveSub(task, activityRaw, subRaw);
        subId = r.subId;
        if (!subId) rowErrors.push(r.error!);
      }

      const hoursNum = Number(hoursRaw);
      const minutesNum = minutesRaw ? Number(minutesRaw) : 0;
      if (!hoursRaw && !minutesRaw) rowErrors.push('Missing Hours/Minutes');
      if (hoursRaw && (!Number.isInteger(hoursNum) || hoursNum < 0 || hoursNum > 23))
        rowErrors.push('Hours must be a whole number between 0 and 23');
      if (minutesRaw && (!Number.isInteger(minutesNum) || minutesNum < 0 || minutesNum > 55 || minutesNum % 5 !== 0))
        rowErrors.push('Minutes must be one of 0, 5, 10, …, 55');
      const totalHours =
        (Number.isFinite(hoursNum) ? hoursNum : 0) + (Number.isFinite(minutesNum) ? minutesNum : 0) / 60;
      if (rowErrors.length === 0 && totalHours <= 0) rowErrors.push('Duration must be greater than 0');

      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, message: rowErrors.join('; ') });
        skipped++;
        continue;
      }

      // Dedup on (date + task + description) — against existing DB entries and
      // earlier rows in this file.
      const key = dedupKey(ymd!, task!.id, description);
      if (seen.has(key)) {
        errors.push({ row: rowNum, message: 'Duplicate of an existing entry (same date, task & description) — skipped' });
        skipped++;
        continue;
      }

      const week = await resolveWeek(ymd!);
      if (!week.id) {
        errors.push({ row: rowNum, message: week.error! });
        skipped++;
        continue;
      }

      try {
        const created = await this.addEntry(
          week.id,
          {
            projectId: task!.projectId,
            taskId: task!.id,
            taskSubActivityMasterId: subId!,
            date: `${ymd}T00:00:00.000Z`,
            hours: totalHours,
            description: description || undefined,
            timeZone,
          } as CreateTimesheetEntryDto,
          user.role,
          user.id,
          batch.id, // tag the entry so it can be rolled back with the batch
        );
        if (created.effortWarning) {
          warnings.push({ row: rowNum, message: created.effortWarning });
        }
        imported++;
        seen.add(key); // only after a successful insert, so a failed row doesn't mask a later valid one
      } catch (e: any) {
        errors.push({ row: rowNum, message: e?.message ?? 'Failed to add entry' });
        skipped++;
      }
    }

    await this.prisma.bulkUploadBatch.update({
      where: { id: batch.id },
      data: { importedCount: imported, skippedCount: skipped, errorCount: errors.length, errors },
    });

    return { batchId: batch.id, imported, skipped, errors, warnings };
  }

  /** Most recent bulk uploads run by the current user (for the dialog's quick Undo list). */
  listBulkUploads(user: { id: string; role: string }) {
    return this.prisma.bulkUploadBatch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fileName: true,
        importedCount: true,
        skippedCount: true,
        status: true,
        createdAt: true,
        rolledBackAt: true,
      },
    });
  }

  /** Full, paginated bulk-upload history for the current user (for the View History grid). */
  async listBulkUploadHistory(user: { id: string; role: string }, page = 1, pageSize = 10) {
    const where = { userId: user.id };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.bulkUploadBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fileName: true,
          importedCount: true,
          skippedCount: true,
          errorCount: true,
          status: true,
          createdAt: true,
          rolledBackAt: true,
        },
      }),
      this.prisma.bulkUploadBatch.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  /** Row-level errors for one bulk-upload batch (fetched on demand from the History grid). */
  async getBulkUploadErrors(batchId: string, user: { id: string; role: string }) {
    const batch = await this.prisma.bulkUploadBatch.findUnique({
      where: { id: batchId },
      select: { userId: true, errors: true },
    });
    if (!batch || batch.userId !== user.id) throw new NotFoundException('Bulk upload not found');
    return { batchId, errors: (batch.errors as { row: number; message: string }[] | null) ?? [] };
  }

  /**
   * Undo a bulk upload: delete ONLY the entries this batch created and any weekly
   * timesheet it newly created that is now empty. Manual entries and pre-existing
   * weeks are never touched (they carry no batch tag). Runs in a transaction.
   */
  async rollbackBulkUpload(batchId: string, user: { id: string; role: string }) {
    const batch = await this.prisma.bulkUploadBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Bulk upload not found');
    if (batch.status === 'ROLLED_BACK') {
      throw new BadRequestException('This upload has already been rolled back');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Remove the entries this batch created (manual entries are untagged → untouched).
      //    Only from editable timesheets — never pull entries out of a submitted/approved one.
      const deletedEntries = await tx.timesheetEntry.deleteMany({
        where: {
          bulkUploadBatchId: batchId,
          timesheet: { status: { in: [TimesheetStatus.DRAFT, TimesheetStatus.REJECTED] } },
        },
      });

      // 2. Remove weekly timesheets this batch created that are now empty — but never a
      //    submitted/approved one, and never a pre-existing (reused) week.
      const createdWeeks = await tx.timesheet.findMany({
        where: { bulkUploadBatchId: batchId },
        select: { id: true, status: true, _count: { select: { entries: true } } },
      });
      const removableWeekIds = createdWeeks
        .filter((w) => w._count.entries === 0 && w.status === TimesheetStatus.DRAFT)
        .map((w) => w.id);
      let deletedTimesheets = 0;
      if (removableWeekIds.length > 0) {
        const r = await tx.timesheet.deleteMany({ where: { id: { in: removableWeekIds } } });
        deletedTimesheets = r.count;
      }

      await tx.bulkUploadBatch.update({
        where: { id: batchId },
        data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
      });

      return { deletedEntries: deletedEntries.count, deletedTimesheets };
    });
  }

  // ── Copy Previous Week ────────────────────────────────────────────────────

  async copyPreviousWeek(timesheetId: string) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: { entries: true },
    });

    if (!timesheet) throw new NotFoundException('Timesheet not found');
    if (!timesheet.userId) throw new BadRequestException('Copy previous week is only supported for employee timesheets');
    if (timesheet.entries.length > 0) {
      throw new BadRequestException('Cannot copy — timesheet already has entries');
    }

    const prevStart = dayjs(timesheet.startDate).subtract(7, 'day').toDate();

    const prevTimesheet = await this.prisma.timesheet.findUnique({
      where: {
        user_week: {
          userId: timesheet.userId,
          startDate: prevStart,
        },
      },
      include: { entries: true },
    });

    if (!prevTimesheet) throw new NotFoundException('No previous week timesheet found');

    // Load public holidays and approved leaves for the new week date range
    const newWeekStart = timesheet.startDate;
    const newWeekEnd = timesheet.endDate;

    const [holidays, leaves] = await Promise.all([
      this.prisma.publicHoliday.findMany({
        where: { date: { gte: newWeekStart, lte: newWeekEnd } },
      }),
      this.prisma.leave.findMany({
        where: {
          userId: timesheet.userId,
          status: 'APPROVED',
          startDate: { lte: newWeekEnd },
          endDate: { gte: newWeekStart },
        },
      }),
    ]);

    const holidayDates = new Set(holidays.map(h => dayjs(h.date).format('YYYY-MM-DD')));
    const isOnLeave = (date: Date) =>
      leaves.some(l => dayjs(date).isSame(dayjs(l.startDate), 'day') || (dayjs(date).isAfter(dayjs(l.startDate)) && dayjs(date).isBefore(dayjs(l.endDate))) || dayjs(date).isSame(dayjs(l.endDate), 'day'));

    const entriesToCopy = prevTimesheet.entries.filter(entry => {
      const newDate = dayjs(entry.date).add(7, 'day').toDate();
      const dateKey = dayjs(newDate).format('YYYY-MM-DD');
      return !holidayDates.has(dateKey) && !isOnLeave(newDate);
    });

    await this.prisma.timesheetEntry.createMany({
      data: entriesToCopy.map(entry => ({
        timesheetId,
        projectId: entry.projectId,
        date: dayjs(entry.date).add(7, 'day').toDate(),
        hours: entry.hours,
        description: entry.description,
        taskType: entry.taskType,
        activityMasterId: entry.activityMasterId,
        taskSubActivityMasterId: entry.taskSubActivityMasterId ?? null,
        taskId: entry.taskId,
        ticketId: entry.ticketId,
      })),
    });

    // Revive any dormant (auto-inactivated) projects touched by the copied entries.
    const copiedProjectIds = [...new Set(entriesToCopy.map(e => e.projectId))];
    if (copiedProjectIds.length) {
      const inactiveProjects = await this.prisma.project.findMany({
        where: { id: { in: copiedProjectIds }, status: ProjectStatus.INACTIVE },
        select: { id: true },
      });
      for (const p of inactiveProjects) {
        await this.projectsService.systemTransition(p.id, ProjectStatus.ACTIVE, {
          actorId: timesheet.userId,
          reason: 'Timesheet activity resumed',
          notifyPm: false,
        });
      }
    }

    return this.prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: { entries: { include: { activityMaster: true, taskSubActivity: { include: { activity: { include: { taskType: true } } } }, task: true, ticket: true } } },
    });
  }

  // ── Missing Timesheets ────────────────────────────────────────────────────

  async getMissingTimesheets(actorId: string, actorRole: string, weekStart: string, departmentId?: string) {
    const scope = await this.scopeResolver.getDataScope(actorRole, 'REPORT_TIMESHEET_VIEW');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    const weekStartDate = new Date(weekStart);
    const weekEndDate = dayjs(weekStartDate).add(6, 'day').endOf('day').toDate();

    const where: any = {
      isActive: true,
      employmentStatus: 'ACTIVE',
      ...(departmentId ? { departmentId } : {}),
    };

    if (allowedIds) {
      where.id = { in: allowedIds };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        role: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    const submittedTimesheets = await this.prisma.timesheet.findMany({
      where: {
        userId: { in: users.map(u => u.id) },
        startDate: weekStartDate,
        status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.RA_APPROVED, TimesheetStatus.PM_APPROVED] },
      },
      select: { userId: true },
    });

    const submittedUserIds = new Set(submittedTimesheets.map(t => t.userId));

    return users
      .filter(u => !submittedUserIds.has(u.id))
      .map(u => ({
        userId: u.id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        email: u.email,
        role: u.role.name,
        department: u.department?.name ?? null,
      }));
  }

  // ── Missing Entries ───────────────────────────────────────────────────────

  async getMissingEntries(
    actorId: string,
    actorRole: string,
    params: { from: string; to: string; userId?: string; departmentId?: string },
  ) {
    const fromDate = new Date(params.from);
    const toDate = new Date(params.to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid from/to date');
    }
    if (toDate < fromDate) {
      throw new BadRequestException('"to" must be on or after "from"');
    }

    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_TIMESHEET_VIEW');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    // Exclude global public holidays in the range.
    const holidays = await this.prisma.publicHoliday.findMany({
      where: { date: { gte: fromDate, lte: toDate }, isGlobal: true },
      select: { date: true },
    });
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

    // Build list of Mon–Fri working days in range (holidays excluded).
    const workingDays: string[] = [];
    const cur = new Date(fromDate);
    while (cur <= toDate) {
      const dow = cur.getDay();
      const iso = cur.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) workingDays.push(iso);
      cur.setDate(cur.getDate() + 1);
    }
    if (!workingDays.length) return [];

    // Build user filter, respecting scope.
    const userWhere: any = { isActive: true, employmentStatus: 'ACTIVE' };
    if (params.departmentId) userWhere.departmentId = params.departmentId;
    if (params.userId) {
      const requestedId = params.userId;
      // Silent scope enforcement: if actor cannot see this user, return empty.
      if (allowedIds && !allowedIds.includes(requestedId)) return [];
      userWhere.id = requestedId;
    } else if (allowedIds) {
      userWhere.id = { in: allowedIds };
    }

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    if (!users.length) return [];

    // Single raw query: all (userId, date) pairs that have at least one entry in range.
    const userIds = users.map((u) => u.id);
    const filled = await this.prisma.$queryRaw<{ userId: string; entryDate: string }[]>`
      SELECT DISTINCT ts."userId", te.date::date::text AS "entryDate"
      FROM "TimesheetEntry" te
      JOIN "Timesheet" ts ON te."timesheetId" = ts.id
      WHERE te.date >= ${fromDate}
        AND te.date <= ${toDate}
        AND ts."userId" = ANY(${userIds}::text[])
    `;
    const filledSet = new Set(filled.map((r) => `${r.userId}:${r.entryDate}`));

    return users
      .map((u) => {
        const missingDates = workingDays.filter((d) => !filledSet.has(`${u.id}:${d}`));
        return {
          userId: u.id,
          name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
          email: u.email,
          department: u.department?.name ?? null,
          missingDates,
          totalMissing: missingDates.length,
        };
      })
      .filter((r) => r.totalMissing > 0);
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  /**
   * Month view of logged hours for a single user: a per-day total plus the
   * entries behind it, so the UI can render the grid and the day detail from a
   * single request instead of one call per clicked date.
   *
   * `month` is YYYY-MM. Omitting `userId` returns the caller's own hours;
   * passing someone else's requires them to be inside the caller's data scope.
   */
  async getCalendarMonth(
    actor: { id: string; role: string },
    params: { month?: string; userId?: string },
  ) {
    const targetUserId = params.userId ?? actor.id;

    if (targetUserId !== actor.id) {
      const scope = await this.scopeResolver.getDataScope(actor.role, 'WORKFORCE_TIMESHEET_VIEW');
      const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actor.id, scope);
      if (allowedIds && !allowedIds.includes(targetUserId)) {
        throw new ForbiddenException('You do not have permission to view this user\'s timesheet calendar');
      }
    }

    const base = params.month ? dayjs(`${params.month}-01`) : dayjs();
    if (!base.isValid()) {
      throw new BadRequestException('Invalid month — expected YYYY-MM');
    }

    const monthStart = base.startOf('month');
    const monthEnd = base.endOf('month');

    const entries = await this.prisma.timesheetEntry.findMany({
      where: {
        timesheet: { userId: targetUserId },
        date: { gte: monthStart.toDate(), lte: monthEnd.toDate() },
      },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        ticket: { select: { id: true, title: true } },
        activityMaster: { select: { activity: true, subActivity: true } },
        taskSubActivity: {
          include: { activity: { include: { taskType: true } } },
        },
        timesheet: { select: { id: true, status: true } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    // Group by calendar day. Keyed on the entry's own date so a week straddling
    // two months lands each day in the month it actually belongs to.
    const byDate = new Map<string, typeof entries>();
    for (const entry of entries) {
      const key = dayjs(entry.date).format('YYYY-MM-DD');
      const bucket = byDate.get(key);
      if (bucket) bucket.push(entry);
      else byDate.set(key, [entry]);
    }

    // Context needed to tell a real shortfall from a day nobody was meant to work:
    // weekends, public holidays and approved leave must not be flagged.
    const [{ minDailyHours }, holidays, leaves] = await Promise.all([
      this.getSettings(),
      this.prisma.publicHoliday.findMany({
        where: { date: { gte: monthStart.toDate(), lte: monthEnd.toDate() } },
        select: { date: true, name: true, isOptional: true },
      }),
      this.prisma.leave.findMany({
        where: {
          userId: targetUserId,
          status: 'APPROVED',
          startDate: { lte: monthEnd.toDate() },
          endDate: { gte: monthStart.toDate() },
        },
        select: { startDate: true, endDate: true, isHalfDay: true, leaveTypeCode: true },
      }),
    ]);

    const holidayByDate = new Map(
      holidays
        .filter((h) => !h.isOptional)
        .map((h) => [dayjs(h.date).format('YYYY-MM-DD'), h.name] as const),
    );

    // Leaves are stored as ranges; expand to the individual days they cover.
    const leaveByDate = new Map<string, { isHalfDay: boolean; leaveTypeCode: string | null }>();
    for (const leave of leaves) {
      let cursor = dayjs(leave.startDate).startOf('day');
      const last = dayjs(leave.endDate).startOf('day');
      while (cursor.isSame(last) || cursor.isBefore(last)) {
        leaveByDate.set(cursor.format('YYYY-MM-DD'), {
          isHalfDay: leave.isHalfDay,
          leaveTypeCode: leave.leaveTypeCode,
        });
        cursor = cursor.add(1, 'day');
      }
    }

    const days = [...byDate.entries()]
      .map(([date, dayEntries]) => ({
        date,
        hours: dayEntries.reduce((sum, e) => sum + e.hours, 0),
        entries: dayEntries.map(entry => ({
          id: entry.id,
          timesheetId: entry.timesheetId,
          status: entry.timesheet.status,
          hours: entry.hours,
          description: entry.description,
          projectId: entry.projectId,
          projectName: entry.project?.name ?? null,
          taskName: entry.task?.title ?? entry.ticket?.title ?? null,
          taskType: entry.taskType,
          activity: entry.taskSubActivity
            ? {
                type: entry.taskSubActivity.activity.taskType.name,
                activity: entry.taskSubActivity.activity.name,
                subActivity: entry.taskSubActivity.name,
              }
            : entry.activityMaster
              ? {
                  type: String(entry.taskType).replace('_', ' '),
                  activity: entry.activityMaster.activity,
                  subActivity: entry.activityMaster.subActivity,
                }
              : null,
        })),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Emit a row for EVERY date in the month, not just the ones with entries — a
    // zero-hour working day is exactly what the shortfall highlighting is for, and
    // it has no entries to be grouped from.
    const daysByDate = new Map(days.map((d) => [d.date, d] as const));
    const allDays: {
      date: string;
      hours: number;
      entries: (typeof days)[number]['entries'];
      isWeekend: boolean;
      isHoliday: boolean;
      holidayName: string | null;
      isLeave: boolean;
      isWorkingDay: boolean;
      isShortfall: boolean;
    }[] = [];

    for (let d = monthStart; d.isBefore(monthEnd) || d.isSame(monthEnd, 'day'); d = d.add(1, 'day')) {
      const date = d.format('YYYY-MM-DD');
      const existing = daysByDate.get(date);
      const hours = existing?.hours ?? 0;
      const dow = d.day(); // 0 = Sun, 6 = Sat
      const isWeekend = dow === 0 || dow === 6;
      const holidayName = holidayByDate.get(date) ?? null;
      const leave = leaveByDate.get(date);
      // A half-day leave still leaves half a working day, so it stays a working
      // day and its (reduced) hours are still measured against the threshold.
      const isFullDayLeave = !!leave && !leave.isHalfDay;
      const isWorkingDay = !isWeekend && !holidayName && !isFullDayLeave;

      allDays.push({
        date,
        hours,
        entries: existing?.entries ?? [],
        isWeekend,
        isHoliday: !!holidayName,
        holidayName,
        isLeave: !!leave,
        isWorkingDay,
        isShortfall: isWorkingDay && hours < minDailyHours,
      });
    }

    return {
      userId: targetUserId,
      month: monthStart.format('YYYY-MM'),
      monthStart: monthStart.format('YYYY-MM-DD'),
      monthEnd: monthEnd.format('YYYY-MM-DD'),
      minDailyHours,
      totalHours: days.reduce((sum, d) => sum + d.hours, 0),
      daysLogged: days.length,
      days: allDays,
    };
  }

  // ── Backdated Approval ────────────────────────────────────────────────────

  async getBackdatedRequests(actorId: string, actorRole: string) {
    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_TIMESHEET_APPROVE');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    const where: any = { status: 'PENDING' };
    if (allowedIds) {
      where.userId = { in: allowedIds };
    }

    return this.prisma.backdatedTimesheetRequest.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        timesheet: { select: { id: true, startDate: true, endDate: true, projectId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveBackdatedRequest(requestId: string, approverId: string) {
    const request = await this.prisma.backdatedTimesheetRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Backdated request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
    }

    // Create the entry directly, bypassing backdated check
    const entryDate = request.entryDate;
    const dailyEntries = await this.prisma.timesheetEntry.findMany({
      where: { timesheetId: request.timesheetId, date: entryDate },
    });
    // Daily hours limit check removed as per requirement

    await this.prisma.backdatedTimesheetRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', approverId, approvedAt: new Date() },
    });

    await this.notificationsService.send(
      request.userId,
      NotificationType.APPROVED,
      'Backdated Timesheet Request Approved',
      `Your backdated entry request for ${dayjs(entryDate).format('DD MMM YYYY')} has been approved.`,
      { entityType: 'BackdatedTimesheetRequest', entityId: requestId },
    );

    return { message: 'Backdated request approved. Employee may now log the entry.' };
  }

  async rejectBackdatedRequest(requestId: string, approverId: string) {
    const request = await this.prisma.backdatedTimesheetRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Backdated request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
    }

    await this.prisma.backdatedTimesheetRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', approverId },
    });

    await this.notificationsService.send(
      request.userId,
      NotificationType.REJECTED,
      'Backdated Timesheet Request Rejected',
      `Your backdated entry request for ${dayjs(request.entryDate).format('DD MMM YYYY')} has been rejected.`,
      { entityType: 'BackdatedTimesheetRequest', entityId: requestId },
    );

    return { message: 'Backdated request rejected.' };
  }

  // ── Workflow ──────────────────────────────────────────────────────────────

  async submit(id: string, actorId: string, actorRole: string) {
    const timesheet = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) throw new NotFoundException('Timesheet not found');
    
    // For submit, usually it's the owner (OWN scope for WORKFORCE_TIMESHEET_CREATE)
    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_TIMESHEET_CREATE');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);
    if (allowedIds && timesheet.userId && !allowedIds.includes(timesheet.userId)) {
      throw new BadRequestException('You do not have permission to submit this timesheet');
    }

    if (timesheet.status !== TimesheetStatus.DRAFT && timesheet.status !== TimesheetStatus.REJECTED) {
      throw new BadRequestException('Timesheet has already been submitted for approval');
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        status: TimesheetStatus.SUBMITTED,
        lastStatusChange: new Date(),
        rejectionRemarks: null,
      },
    });
  }

  async raApprove(id: string, actorId: string, actorRole: string) {
    const timesheet = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) throw new NotFoundException('Timesheet not found');

    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_TIMESHEET_APPROVE');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);
    if (allowedIds && timesheet.userId && !allowedIds.includes(timesheet.userId)) {
      throw new BadRequestException('You do not have permission to approve this timesheet');
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        status: TimesheetStatus.RA_APPROVED,
        approverId: actorId,
        lastStatusChange: new Date(),
        rejectionRemarks: null,
      },
    });
  }

  async pmApprove(id: string, actorId: string, actorRole: string) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id },
      include: { entries: true },
    });

    if (!timesheet) throw new NotFoundException('Timesheet not found');

    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_TIMESHEET_APPROVE');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);
    if (allowedIds && timesheet.userId && !allowedIds.includes(timesheet.userId)) {
      throw new BadRequestException('You do not have permission to approve this timesheet');
    }

    if (timesheet.status !== TimesheetStatus.RA_APPROVED) {
      throw new BadRequestException('Timesheet must be approved by RA before PM can finalize');
    }

    // Group entries by date to check daily totals
    const dailyTotals: Record<string, number> = {};
    timesheet.entries.forEach(entry => {
      const dateKey = entry.date.toISOString().split('T')[0];
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + entry.hours;
    });

    // Generate Comp-Off records for days > 9 hours
    for (const [date, total] of Object.entries(dailyTotals)) {
      if (total > 9 && timesheet.userId) {
        const extraHours = total - 9;
        await this.prisma.compOff.create({
          data: {
            userId: timesheet.userId,
            date: new Date(date),
            hoursWorked: total,
            extraHours,
            status: 'PENDING',
          },
        });

        await this.prisma.leaveBalance.upsert({
          where: { userId_leaveTypeCode: { userId: timesheet.userId, leaveTypeCode: 'COMP_OFF' } },
          update: { earnedBalance: { increment: extraHours / 8 } },
          create: { userId: timesheet.userId, leaveTypeCode: 'COMP_OFF', earnedBalance: extraHours / 8 },
        });
      }
    }

    // Update actualEffort on associated Tasks/Tickets
    for (const entry of timesheet.entries) {
      if (entry.taskId) {
        await this.prisma.task.update({
          where: { id: entry.taskId },
          data: { actualEffort: { increment: entry.hours } },
        });
      }
      if (entry.ticketId) {
        await this.prisma.ticket.update({
          where: { id: entry.ticketId },
          data: { actualEffort: { increment: entry.hours } },
        });
      }
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        status: TimesheetStatus.PM_APPROVED,
        approverId: actorId,
        lastStatusChange: new Date(),
        rejectionRemarks: null,
      },
    });
  }

  async reject(id: string, actorId: string, actorRole: string, remarks: string) {
    const timesheet = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) throw new NotFoundException('Timesheet not found');

    const trimmedRemarks = remarks.trim();
    if (!trimmedRemarks) {
      throw new BadRequestException('Rejection remarks are required');
    }

    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_TIMESHEET_APPROVE');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);
    if (allowedIds && timesheet.userId && !allowedIds.includes(timesheet.userId)) {
      throw new BadRequestException('You do not have permission to reject this timesheet');
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        status: TimesheetStatus.REJECTED,
        approverId: actorId,
        lastStatusChange: new Date(),
        rejectionRemarks: trimmedRemarks,
      },
    });
  }

  /**
   * Resolves the set of team members visible to the actor on the Team Timesheets
   * tab. Shared by the summary and its filter-options endpoint so the autocomplete
   * can never offer a user the summary itself would refuse to return.
   */
  private async buildTeamSummaryUserWhere(
    actorId: string,
    actorRole: string,
    filters: { userId?: string; status?: TimesheetStatus } = {},
  ) {
    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_TIMESHEET_VIEW');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    const userWhere: any = {
      isActive: true,
      employmentStatus: EmploymentStatus.ACTIVE,
    };

    if (allowedIds) {
      userWhere.id = { in: allowedIds.filter(id => id !== actorId) };
    } else {
      userWhere.id = { not: actorId };
    }

    // Narrow to a single member without widening scope: the requested id has to
    // survive the scope filter above, so an out-of-scope id yields no rows.
    if (filters.userId) {
      if (allowedIds) {
        const permitted = allowedIds.includes(filters.userId) && filters.userId !== actorId;
        userWhere.id = { in: permitted ? [filters.userId] : [] };
      } else {
        userWhere.id = filters.userId === actorId ? { in: [] } : filters.userId;
      }
    }

    // Applied on the user query (not post-hoc) so skip/take paginate the filtered
    // set and the reported total stays truthful.
    if (filters.status) {
      userWhere.timesheets = { some: { status: filters.status } };
    }

    return userWhere;
  }

  async getTeamSummaryOptions(actorId: string, actorRole: string) {
    const userWhere = await this.buildTeamSummaryUserWhere(actorId, actorRole);

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
    });

    return users.map(user => ({
      userId: user.id,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
      email: user.email,
    }));
  }

  async getTeamSummary(actorId: string, actorRole: string, query: QueryTeamSummaryDto = {}) {
    const { userId, status, page = 1, limit = 6 } = query;
    const skip = (page - 1) * limit;
    const userWhere = await this.buildTeamSummaryUserWhere(actorId, actorRole, { userId, status });

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where: userWhere }),
    ]);

    const meta = { total, page, limit, totalPages: Math.ceil(total / limit) };

    if (users.length === 0) return { data: [], meta };

    // Only the current page's members — this used to load every timesheet and
    // entry for the actor's whole scope on each request.
    const userIds = users.map(user => user.id);
    const summaryStatuses = [...this.submittedOrApprovedStatuses, TimesheetStatus.REJECTED];
    const monthStart = dayjs().startOf('month').toDate();
    const monthEnd = dayjs().endOf('month').toDate();

    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        userId: { in: userIds },
        status: { in: summaryStatuses },
      },
      include: {
        entries: { select: { hours: true, date: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const data = users.map(user => {
      const userTimesheets = timesheets.filter(timesheet => timesheet.userId === user.id);
      const latestTimesheet = userTimesheets.find(timesheet =>
        this.submittedOrApprovedStatuses.includes(timesheet.status),
      );

      const latestWeekHours =
        latestTimesheet?.entries.reduce((sum, entry) => sum + entry.hours, 0) ?? 0;

      const monthHours = userTimesheets
        .filter(timesheet => this.submittedOrApprovedStatuses.includes(timesheet.status))
        .flatMap(timesheet => timesheet.entries)
        .filter(entry => entry.date >= monthStart && entry.date <= monthEnd)
        .reduce((sum, entry) => sum + entry.hours, 0);

      const pendingTimesheets = userTimesheets.filter(timesheet => timesheet.status === TimesheetStatus.SUBMITTED).length;
      const approvedStatuses: TimesheetStatus[] = [TimesheetStatus.RA_APPROVED, TimesheetStatus.PM_APPROVED];
      const approvedTimesheets = userTimesheets.filter(timesheet =>
        approvedStatuses.includes(timesheet.status),
      ).length;
      const rejectedTimesheets = userTimesheets.filter(timesheet => timesheet.status === TimesheetStatus.REJECTED).length;
      const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;

      return {
        userId: user.id,
        name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        latestWeekStart: latestTimesheet?.startDate.toISOString() ?? null,
        latestWeekEnd: latestTimesheet?.endDate.toISOString() ?? null,
        latestStatus: latestTimesheet?.status ?? null,
        latestWeekHours,
        monthHours,
        pendingTimesheets,
        approvedTimesheets,
        rejectedTimesheets,
      };
    });

    return { data, meta };
  }

  async findAll(
    user: { id: string; role: string },
    userId?: string,
    projectId?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const scope = await this.scopeResolver.getDataScope(user.role, 'WORKFORCE_TIMESHEET_VIEW');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(user.id, scope);
    const parsedStartDate = this.parseDateParam(startDate, 'startDate');
    const parsedEndDate = this.parseDateParam(endDate, 'endDate');
    const dateFilters: any[] = [];

    if (parsedStartDate) {
      dateFilters.push({ endDate: { gte: parsedStartDate } });
    }

    if (parsedEndDate) {
      dateFilters.push({ startDate: { lte: dayjs(parsedEndDate).endOf('day').toDate() } });
    }

    const where: any = {
      entries: projectId ? { some: { projectId } } : undefined,
      status: status ? (status as TimesheetStatus) : undefined,
      AND: dateFilters.length > 0 ? dateFilters : undefined,
    };

    if (userId) {
      if (allowedIds && !allowedIds.includes(userId)) {
        throw new BadRequestException('You do not have permission to view this user\'s timesheets');
      }
      where.userId = userId;
    } else if (allowedIds) {
      where.userId = { in: allowedIds };
    }

    return this.prisma.timesheet.findMany({
      where,
      include: {
        entries: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, reportingAuthorityId: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
          include: {
            project: true,
            task: { include: { parent: { select: { id: true, title: true } } } },
            ticket: true,
            activityMaster: true,
            taskSubActivity: { include: { activity: { include: { taskType: true } } } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        project: { select: { id: true, name: true, type: true } },
      },
    });

    if (!timesheet) return null;

    const dailyTotals: Record<string, number> = {};
    for (const entry of timesheet.entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + entry.hours;
    }

    return { ...timesheet, dailyTotals };
  }

  async removeEntry(entryId: string) {
    const entry = await this.prisma.timesheetEntry.findUnique({
      where: { id: entryId },
      include: { timesheet: true },
    });
    if (!entry) throw new NotFoundException(`Entry "${entryId}" not found`);
    if (entry.timesheet.status !== TimesheetStatus.DRAFT && entry.timesheet.status !== TimesheetStatus.REJECTED) {
      throw new BadRequestException('Cannot delete entries from a submitted or approved timesheet');
    }
    return this.prisma.timesheetEntry.delete({ where: { id: entryId } });
  }

  async updateEntry(entryId: string, dto: UpdateTimesheetEntryDto, actorRole: string) {
    const entry = await this.prisma.timesheetEntry.findUnique({
      where: { id: entryId },
      include: { timesheet: true },
    });
    if (!entry) throw new NotFoundException(`Entry "${entryId}" not found`);

    const timesheet = entry.timesheet;
    if (timesheet.status !== TimesheetStatus.DRAFT && timesheet.status !== TimesheetStatus.REJECTED) {
      throw new BadRequestException('Cannot edit entries on a submitted or approved timesheet');
    }

    // Resolve effective values (fall back to the existing entry when a field is omitted).
    const projectId = dto.projectId ?? entry.projectId;
    const taskId = dto.taskId ?? entry.taskId ?? undefined;
    const ticketId = dto.ticketId ?? entry.ticketId ?? undefined;
    const hours = dto.hours ?? entry.hours;
    const entryDate = dto.date ? new Date(dto.date) : entry.date;

    // 1. Future date restriction
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (entryDate > today) {
      throw new BadRequestException('Timesheet entries cannot be logged for future dates');
    }

    // 2. Closed period lock
    const month = entryDate.getMonth() + 1;
    const year = entryDate.getFullYear();
    const lockPeriod = await this.prisma.timesheetLockPeriod.findUnique({
      where: { month_year: { month, year } },
    });
    if (lockPeriod?.isLocked) {
      throw new BadRequestException(`Timesheet period ${month}-${year} is locked by Finance`);
    }

    // 2.5 Check-in requirement (only re-checked when the entry's date is being changed)
    if (timesheet.userId && dto.date && entryDate.getTime() !== entry.date.getTime()) {
      const checkedIn = await this.attendanceService.hasCheckedIn(timesheet.userId, entryDate, dto.timeZone);
      if (!checkedIn) {
        throw new BadRequestException('Please clock in before filling the timesheet.');
      }
    }

    // 3. Per-entry hours cap: a single entry cannot exceed 4 hours
    if (hours > 4) {
      throw new BadRequestException('A single timesheet entry cannot exceed 4 hours. Please split into multiple entries.');
    }

    // 4. Project and Assignment Enforcement
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new BadRequestException('Selected project does not exist');
    }

    let derivedTaskType: TimesheetTaskType = dto.taskType ?? entry.taskType;
    if (taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          taskTypeMaster: { select: { name: true } },
          taskAssignees: { select: { userId: true } },
        },
      });
      if (!task) {
        throw new BadRequestException('Selected task does not exist');
      }
      if (task.projectId !== projectId) {
        throw new BadRequestException('Selected task does not belong to the selected project');
      }
      if (!this.isAssignedToTask(task, timesheet.userId) && !['ADMIN', 'PM', 'TL'].includes(actorRole)) {
        throw new BadRequestException('Cannot log hours for a task not assigned to you');
      }
      if ((task as any).taskTypeMaster?.name) {
        const typeName = (task as any).taskTypeMaster.name.toUpperCase().replace(/[\s-]/g, '_');
        derivedTaskType = typeName === 'CHANGE_REQUEST' ? TimesheetTaskType.CHANGE_REQUEST : TimesheetTaskType.OBSERVATION;
      }
    }
    if (ticketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { ticketAssignees: { select: { userId: true } } },
      });
      if (!ticket) {
        throw new BadRequestException('Selected ticket does not exist');
      }
      if (ticket.projectId !== projectId) {
        throw new BadRequestException('Selected ticket does not belong to the selected project');
      }
      if (!this.isAssignedToTicket(ticket, timesheet.userId) && !['ADMIN', 'PM', 'TL'].includes(actorRole)) {
        throw new BadRequestException('Cannot log hours for a ticket not assigned to you');
      }
    }

    // 5. Activity / Sub-Activity Validation
    let activityMasterId: string | null = entry.activityMasterId;
    let taskSubActivityMasterId: string | null = entry.taskSubActivityMasterId;

    if (dto.taskSubActivityMasterId) {
      const sub = await this.prisma.taskSubActivityMaster.findUnique({
        where: { id: dto.taskSubActivityMasterId },
      });
      if (!sub || !sub.isActive) {
        throw new BadRequestException('Invalid or inactive sub-activity selection');
      }
      taskSubActivityMasterId = sub.id;
      activityMasterId = null;
    } else if (dto.activityMasterId) {
      const am = await this.prisma.timesheetActivityMaster.findUnique({
        where: { id: dto.activityMasterId },
      });
      if (!am) throw new BadRequestException('Invalid activity master selection');
      activityMasterId = am.id;
      taskSubActivityMasterId = null;
    }

    const updated = await this.prisma.timesheetEntry.update({
      where: { id: entryId },
      data: {
        projectId,
        date: entryDate,
        hours,
        description: dto.description ?? entry.description,
        taskType: derivedTaskType,
        activityMasterId,
        taskSubActivityMasterId,
        taskId: taskId ?? null,
        ticketId: ticketId ?? null,
      },
    });

    // Same soft over-estimate warning as addEntry, with this entry excluded from
    // the logged total so its own hours are not counted twice.
    let effortWarning: string | null = null;
    if (taskId) {
      try {
        const status = await this.getTaskEffortStatus(taskId, {
          incomingHours: hours,
          excludeEntryId: entryId,
        });
        effortWarning = status.warning;
        if (effortWarning) {
          this.logger.warn(`Timesheet entry ${entryId} is over estimate — ${effortWarning}`);
        }
      } catch (error) {
        // A warning must never fail the edit that was just saved.
        this.logger.error('Over-estimate check failed', error);
      }
    }

    return { ...updated, effortWarning };
  }

  // ── Activity Master ───────────────────────────────────────────────────────

  findAllActivities(taskType?: string) {
    return this.prisma.timesheetActivityMaster.findMany({
      where: taskType ? { taskType: taskType as TimesheetTaskType } : {},
      orderBy: [{ taskType: 'asc' }, { activity: 'asc' }, { subActivity: 'asc' }],
    });
  }

  createActivity(data: { taskType: string; activity: string; subActivity: string; meaning?: string }) {
    return this.prisma.timesheetActivityMaster.create({
      data: {
        taskType: data.taskType as TimesheetTaskType,
        activity: data.activity,
        subActivity: data.subActivity,
        meaning: data.meaning,
      },
    });
  }

  async updateActivity(id: string, data: { activity?: string; subActivity?: string; meaning?: string }) {
    const record = await this.prisma.timesheetActivityMaster.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Activity master "${id}" not found`);
    return this.prisma.timesheetActivityMaster.update({ where: { id }, data });
  }

  async removeActivity(id: string) {
    const record = await this.prisma.timesheetActivityMaster.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Activity master "${id}" not found`);
    return this.prisma.timesheetActivityMaster.delete({ where: { id } });
  }
}
