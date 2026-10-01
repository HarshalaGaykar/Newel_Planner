import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CRStatus, NotificationType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskUploadHistoryDto } from './dto/query-task-upload-history.dto';
import { QueryTaskBulkUploadHistoryDto } from './dto/query-task-bulk-upload-history.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';
import { ExportService } from '../reports/export.service';
import { deriveDailyEffort } from './daily-effort.util';
import {
  checkSubtaskEffortCeiling,
  formatHours,
  resolveEffortHours,
  sumEffortHours,
} from './subtask-rules.util';

const WBS_LEVELS = ['PHASE', 'MODULE', 'TASK', 'SUBTASK'];
const WBS_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const WBS_STATUSES = ['BACKLOG', 'WIP', 'QA', 'COMPLETED'];

// Order defines the columns in the downloadable template and the expected
// import headers. `key` is the normalised header used for case-insensitive matching.
const WBS_COLUMNS: { header: string; key: string; required?: boolean; note: string }[] = [
  { header: 'Title', key: 'title', required: true, note: 'Required. Must be unique within the file (used to link Parent Title).' },
  { header: 'Description', key: 'description', note: 'Optional free text.' },
  { header: 'WBS Level', key: 'wbslevel', note: 'One of: PHASE, MODULE, TASK, SUBTASK.' },
  { header: 'Parent Title', key: 'parenttitle', note: 'REQUIRED for SUBTASK rows and must point to a TASK. Optional for other levels; a row only nests when this is filled.' },
  { header: 'Assignee Email', key: 'assigneeemail', required: true, note: 'Required. Email of the assignee. Blank, an email not found in the system, or a user not allocated to this project, causes the whole row to be skipped.' },
  { header: 'Skills', key: 'skills', note: 'Comma-separated skill names. Unknown names are ignored.' },
  { header: 'Priority', key: 'priority', note: 'One of: LOW, MEDIUM, HIGH, CRITICAL. Defaults to MEDIUM.' },
  { header: 'Status', key: 'status', note: 'One of: BACKLOG, WIP, QA, COMPLETED. Defaults to BACKLOG.' },
  { header: 'Task Type', key: 'tasktype', note: 'Task type name from the system master (e.g. Development, Support). Controls available activities in timesheets. Leave blank to leave unassigned.' },
  { header: 'Plan Start', key: 'planstart', note: 'Planned start date (e.g. 2026-01-31).' },
  { header: 'Plan End', key: 'planend', note: 'Planned end date. Must be on/after Plan Start.' },
  { header: 'Plan Hours', key: 'planhours', note: 'Planned effort in hours (number >= 0).' },
  { header: 'Complexity', key: 'complexity', note: 'Integer from 1 to 5.' },
  { header: 'Progress%', key: 'progress', note: 'Completion percentage from 0 to 100.' },
];

// ── Task Board bulk upload ────────────────────────────────────────────────
// Mirrors the "Create Task" modal on the global Task Board. Unlike the WBS
// importer (which is scoped to one project), Project is a column here so a
// single file can span projects.
const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const TASK_STATUSES = ['Backlog', 'In Progress', 'In Review', 'Done'];

// Accepts the human labels shown on the board as well as the raw enum values.
const norm = (s: unknown) => (s ?? '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
const TASK_PRIORITY_MAP: Record<string, string> = {
  low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL',
};
const TASK_STATUS_MAP: Record<string, string> = {
  backlog: 'BACKLOG',
  inprogress: 'WIP', wip: 'WIP',
  inreview: 'QA', qa: 'QA',
  done: 'COMPLETED', completed: 'COMPLETED',
};

// Order defines both the template columns and the accepted import headers.
const TASK_COLUMNS: { header: string; key: string; required?: boolean; note: string }[] = [
  { header: 'Title', key: 'title', required: true, note: 'Required. The task title.' },
  { header: 'Description', key: 'description', note: 'Optional free text.' },
  { header: 'Start Date', key: 'startdate', required: true, note: 'Required. Format YYYY-MM-DD (e.g. 2026-07-15).' },
  { header: 'End Date', key: 'enddate', required: true, note: 'Required. Must be on/after Start Date.' },
  { header: 'Planned Start Date', key: 'plannedstart', note: 'Optional. Planned start (YYYY-MM-DD).' },
  { header: 'Planned End Date', key: 'plannedend', note: 'Optional. Planned end. Must be on/after Planned Start.' },
  { header: 'Project', key: 'project', required: true, note: 'Required. Pick from the dropdown. If two projects share a name, the dropdown shows a code/id in brackets, e.g. "Process Dashboard [PRJ-001]" — keep the brackets so the correct project is matched.' },
  { header: 'Priority', key: 'priority', note: 'One of: Low, Medium, High, Critical. Defaults to Medium.' },
  { header: 'Status', key: 'status', note: 'One of: Backlog, In Progress, In Review, Done. Defaults to Backlog.' },
  { header: 'Task Type', key: 'tasktype', note: 'Optional. Pick an active task type from the dropdown.' },
  { header: 'Assignees', key: 'assignees', note: 'Optional. Pick a Project first, then choose assignees from the dropdown — it lists only that project\'s allocated users as "Name <email>". For multiple people, type a comma-separated list of these entries (or plain emails). Users not allocated to the project, or unknown, are skipped with a warning (the task is still created).' },
  { header: 'Estimated Effort (Hours)', key: 'effort', note: 'Optional. A number greater than 0.' },
];

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private exportService: ExportService,
  ) {}

  /**
   * Notify people a task has been assigned to them — in-app plus email, subject
   * to each user's notification preferences (checked inside NotificationsService).
   *
   * `taskIds` holding more than one entry is the bulk-import case: those collapse
   * into a single digest per person, because a 200-row import would otherwise
   * send 200 separate mails to the same inbox.
   *
   * Never throws. A mail server outage must not roll back the task the user just
   * created, but it must still be visible in the logs.
   */
  private async notifyAssignees(
    taskIds: string[],
    userIds: string[],
    actorId: string,
  ): Promise<void> {
    // Assigning something to yourself does not warrant a notification.
    const recipients = [...new Set(userIds)].filter((id) => id && id !== actorId);
    if (!recipients.length || !taskIds.length) return;

    try {
      const [tasks, users, actor] = await Promise.all([
        this.prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: {
            id: true, title: true, priority: true, endDate: true, plannedEnd: true,
            project: { select: { name: true } },
          },
        }),
        this.prisma.user.findMany({
          where: { id: { in: recipients } },
          select: { id: true, firstName: true, lastName: true, email: true },
        }),
        this.prisma.user.findUnique({
          where: { id: actorId },
          select: { firstName: true, lastName: true, email: true },
        }),
      ]);

      if (!tasks.length || !users.length) return;

      const displayName = (u: { firstName?: string | null; lastName?: string | null; email?: string } | null) =>
        [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || 'Someone';

      const assignedBy = displayName(actor);
      const projectName = tasks[0].project?.name ?? 'a project';
      const titles = tasks.map((t) => t.title);
      const isDigest = tasks.length > 1;

      const title = isDigest
        ? `${tasks.length} tasks assigned to you`
        : `New task assigned: ${titles[0]}`;
      const body = isDigest
        ? `${assignedBy} assigned you ${tasks.length} tasks in ${projectName}.`
        : `${assignedBy} assigned you "${titles[0]}" in ${projectName}.`;

      await Promise.all(
        users.map(async (user) => {
          const emailContent = this.emailService.buildTaskAssignedEmail({
            recipientName: user.firstName || user.email,
            taskTitles: titles,
            projectName,
            assignedBy,
            priority: isDigest ? null : tasks[0].priority,
            dueDate: isDigest ? null : (tasks[0].endDate ?? tasks[0].plannedEnd),
          });

          try {
            await this.notificationsService.send(
              user.id,
              NotificationType.TASK_ASSIGNED,
              title,
              body,
              {
                entityType: 'TASK',
                entityId: isDigest ? null : tasks[0].id,
                taskIds: tasks.map((t) => t.id),
                link: '/tasks',
              },
              false,
              emailContent,
            );
          } catch (error) {
            this.logger.error(
              `Task assignment notification to ${user.email} failed — ` +
                `${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }),
      );
    } catch (error) {
      this.logger.error(
        `Task assignment notifications could not be sent — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build a styled .xlsx WBS template: a "WBS" sheet with a header row, dropdown
   * data-validations on WBS Level / Priority / Status, one example row, plus an
   * "Instructions" sheet documenting every column.
   */
  async generateWbsTemplate(): Promise<Buffer> {
    const taskTypes = await this.prisma.taskTypeMaster.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    const taskTypeNames = taskTypes.map((t) => t.name);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('WBS');

    const headerRow = sheet.addRow(WBS_COLUMNS.map((c) => c.header));
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle' };

    // Example rows: a TASK at root, then a SUBTASK that points to that TASK.
    sheet.addRow([
      'Login feature', 'Build the login experience', 'TASK', '', '', 'NestJS, Prisma',
      'HIGH', 'BACKLOG', taskTypeNames[0] ?? '', '2026-01-05', '2026-01-20', 40, 3, 0,
    ]);
    sheet.addRow([
      'Build login form', 'UI + validation', 'SUBTASK', 'Login feature', '', 'React',
      'MEDIUM', 'WIP', taskTypeNames[0] ?? '', '2026-01-06', '2026-01-12', 16, 2, 25,
    ]);

    // Column widths + frozen header.
    sheet.columns.forEach((col, i) => {
      col.width = Math.max(WBS_COLUMNS[i].header.length + 4, 16);
    });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Dropdown validations (rows 2..1000) on the enum columns.
    const addList = (key: string, values: string[]) => {
      const colNum = WBS_COLUMNS.findIndex((c) => c.key === key) + 1;
      for (let r = 2; r <= 1000; r++) {
        sheet.getCell(r, colNum).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${values.join(',')}"`],
        };
      }
    };
    addList('wbslevel', WBS_LEVELS);
    addList('priority', WBS_PRIORITIES);
    addList('status', WBS_STATUSES);
    if (taskTypeNames.length) addList('tasktype', taskTypeNames);

    // Instructions sheet.
    const help = workbook.addWorksheet('Instructions');
    const helpHeader = help.addRow(['Column', 'Required', 'Notes']);
    helpHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
    helpHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    WBS_COLUMNS.forEach((c) => help.addRow([c.header, c.required ? 'Yes' : 'No', c.note]));
    help.columns[0].width = 18;
    help.columns[1].width = 10;
    help.columns[2].width = 80;

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Parse an uploaded .xlsx/.csv WBS file and bulk-create tasks for a project.
   * Validates per row, returns { imported, skipped, errors } so the caller can
   * surface a row-by-row report. Valid rows are imported even if others fail.
   */
  async uploadWbs(
    file: Express.Multer.File,
    projectId: string,
    user: { id: string; role: string },
  ): Promise<{ imported: number; skipped: number; errors: { row: number; message: string }[] }> {
    if (!['ADMIN', 'PM', 'TL'].includes(user.role)) {
      throw new ForbiddenException('Only PMs, TLs, and Admins can import tasks');
    }
    if (!projectId) throw new BadRequestException('projectId is required');
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // ── Parse the workbook (.csv via stream, .xlsx via buffer load) ──────────
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

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File contains no worksheets.');

    // ── Map headers → column index (case-insensitive, ignores non-alphanumerics) ──
    const normalise = (s: unknown) => (s ?? '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const headerRow = worksheet.getRow(1).values as any[];
    const colIndex: Record<string, number> = {};
    headerRow.forEach((h, i) => {
      if (h) colIndex[normalise(h)] = i;
    });
    if (colIndex['title'] === undefined) {
      throw new BadRequestException('Missing required column "Title".');
    }
    if (colIndex['assigneeemail'] === undefined) {
      throw new BadRequestException('Missing required column "Assignee Email".');
    }

    const cell = (row: ExcelJS.Row, key: string): string => {
      const idx = colIndex[key];
      if (idx === undefined) return '';
      const v = row.getCell(idx).value as any;
      if (v == null) return '';
      if (v instanceof Date) return v.toISOString().substring(0, 10);
      if (typeof v === 'object' && 'text' in v) return String(v.text).trim(); // rich text / hyperlink
      return String(v).trim();
    };

    const errors: { row: number; message: string }[] = [];
    type ParsedRow = {
      rowNum: number;
      data: any;
      wbsLevel: string;
      parentTitle: string;
      email: string;
      skillNames: string[];
      taskTypeName: string;
    };
    const parsedRows: ParsedRow[] = [];
    const emailsToResolve = new Set<string>();
    const skillNamesToResolve = new Set<string>();
    const taskTypeNamesToResolve = new Set<string>();
    let skipped = 0;

    // ── Pass A: validate & parse every data row ──────────────────────────────
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const title = cell(row, 'title');
      const description = cell(row, 'description');
      const wbsLevel = cell(row, 'wbslevel').toUpperCase();
      const parentTitle = cell(row, 'parenttitle');
      const email = cell(row, 'assigneeemail').toLowerCase();
      const skillsRaw = cell(row, 'skills');
      const priority = cell(row, 'priority').toUpperCase();
      const status = cell(row, 'status').toUpperCase();
      const taskTypeName = cell(row, 'tasktype').trim();
      const planStart = cell(row, 'planstart');
      const planEnd = cell(row, 'planend');
      const planHours = cell(row, 'planhours');
      const complexity = cell(row, 'complexity');
      const progress = cell(row, 'progress');

      // Skip fully blank rows silently.
      if (![title, description, wbsLevel, parentTitle, email, skillsRaw, priority, status, taskTypeName, planStart, planEnd, planHours, complexity, progress].some((v) => v)) {
        continue;
      }

      const rowErrors: string[] = [];
      if (!title) rowErrors.push('Title is required');
      if (!email) rowErrors.push('Assignee Email is required');
      if (wbsLevel && !WBS_LEVELS.includes(wbsLevel)) rowErrors.push(`Invalid WBS Level "${wbsLevel}"`);
      if (priority && !WBS_PRIORITIES.includes(priority)) rowErrors.push(`Invalid Priority "${priority}"`);
      if (status && !WBS_STATUSES.includes(status)) rowErrors.push(`Invalid Status "${status}"`);
      // A SUBTASK must explicitly belong to a task.
      if (wbsLevel === 'SUBTASK' && !parentTitle) rowErrors.push('SUBTASK requires a Parent Title — the task it belongs to');

      const start = planStart ? new Date(planStart) : undefined;
      const end = planEnd ? new Date(planEnd) : undefined;
      if (planStart && isNaN(start!.getTime())) rowErrors.push('Invalid Plan Start date');
      if (planEnd && isNaN(end!.getTime())) rowErrors.push('Invalid Plan End date');
      if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
        rowErrors.push('Plan End cannot be before Plan Start');
      }

      let plannedHours: number | undefined;
      if (planHours) {
        plannedHours = Number(planHours);
        if (isNaN(plannedHours) || plannedHours < 0) rowErrors.push('Plan Hours must be a number >= 0');
      }
      let complexityVal: number | undefined;
      if (complexity) {
        complexityVal = Number(complexity);
        if (!Number.isInteger(complexityVal) || complexityVal < 1 || complexityVal > 5) rowErrors.push('Complexity must be an integer 1-5');
      }
      let progressPct: number | undefined;
      if (progress) {
        progressPct = Number(progress);
        if (isNaN(progressPct) || progressPct < 0 || progressPct > 100) rowErrors.push('Progress% must be between 0 and 100');
      }

      if (rowErrors.length) {
        errors.push({ row: rowNum, message: rowErrors.join('; ') });
        skipped++;
        continue;
      }

      if (email) emailsToResolve.add(email);
      const skillNames = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
      skillNames.forEach((n) => skillNamesToResolve.add(n.toLowerCase()));
      if (taskTypeName) taskTypeNamesToResolve.add(taskTypeName.toLowerCase());

      parsedRows.push({
        rowNum,
        wbsLevel,
        parentTitle,
        email,
        skillNames,
        taskTypeName,
        data: {
          title,
          description: description || undefined,
          wbsLevel: wbsLevel || undefined,
          priority: priority || undefined,
          status: status || undefined,
          plannedStart: start,
          plannedEnd: end,
          plannedHours: plannedHours ?? 0,
          complexity: complexityVal,
          progressPct: progressPct ?? 0,
        },
      });
    }

    if (!parsedRows.length) {
      return { imported: 0, skipped, errors };
    }

    // ── Pre-resolve assignees & skills in one query each (avoid N+1) ─────────
    const userByEmail = new Map<string, string>();
    if (emailsToResolve.size) {
      const users = await this.prisma.user.findMany({
        where: { email: { in: [...emailsToResolve], mode: 'insensitive' } },
        select: { id: true, email: true },
      });
      users.forEach((u) => userByEmail.set(u.email.toLowerCase(), u.id));
    }
    // Allocated users for this project — an assignee must be allocated to the
    // project before they can be assigned a task in it (mirrors bulkUploadTasks
    // and validateAssigneesAllocated; no startDate/endDate check, same as those).
    const allocatedUserIds = new Set<string>();
    const resolvedUserIds = [...new Set(userByEmail.values())];
    if (resolvedUserIds.length) {
      const allocations = await this.prisma.allocation.findMany({
        where: { projectId, userId: { in: resolvedUserIds } },
        select: { userId: true },
      });
      allocations.forEach((a) => a.userId && allocatedUserIds.add(a.userId));
    }
    const skillByName = new Map<string, string>();
    if (skillNamesToResolve.size) {
      const skills = await this.prisma.skill.findMany({
        where: { name: { in: [...skillNamesToResolve], mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      skills.forEach((s) => skillByName.set(s.name.toLowerCase(), s.id));
    }
    const taskTypeByName = new Map<string, string>();
    if (taskTypeNamesToResolve.size) {
      const types = await this.prisma.taskTypeMaster.findMany({
        where: { name: { in: [...taskTypeNamesToResolve], mode: 'insensitive' }, isActive: true },
        select: { id: true, name: true },
      });
      types.forEach((t) => taskTypeByName.set(t.name.toLowerCase(), t.id));
    }

    // Existing tasks in the project, so Parent Title can reference a prior task too.
    const existingTasks = await this.prisma.task.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        wbsLevel: true,
        assigneeId: true,
        // Needed by the subtask effort ceiling below, for the case where this
        // file's subtasks hang off a parent that already existed in the project.
        estimatedEffort: true,
        plannedHours: true,
        parent: { select: { title: true } },
      },
    });
    const titleToId = new Map<string, string>();
    const titleToLevel = new Map<string, string>(); // title → WBS level (file rows take precedence)
    existingTasks.forEach((t) => {
      titleToId.set(t.title, t.id);
      if (t.wbsLevel) titleToLevel.set(t.title, t.wbsLevel.toUpperCase());
    });
    // Duplicate detection is parent+title+assignee, NOT title alone:
    //  - the same task title legitimately appears on multiple rows when it's
    //    assigned to several people (title+assignee alone isn't enough either)
    //  - the same subtask name (e.g. "Design", "Review") legitimately repeats
    //    under different parent tasks, so title+assignee alone would wrongly
    //    collide two unrelated subtasks that happen to share a name.
    const dedupKeyOf = (parentTitle: string, title: string, assigneeId: string | null) =>
      `${parentTitle}::${title}::${assigneeId ?? ''}`;
    const dedupExisting = new Set(
      existingTasks.map((t) => dedupKeyOf(t.parent?.title ?? '', t.title, t.assigneeId)),
    );
    const dedupSeen = new Set(dedupExisting);

    // Drop rows whose (non-blank) Assignee Email doesn't resolve, or resolves to
    // a user not allocated to this project — skip entirely, so they (and their
    // titles) can't act as a parent for other rows.
    const creatableRows = parsedRows.filter((r) => {
      if (r.email && !userByEmail.get(r.email)) {
        errors.push({ row: r.rowNum, message: `Assignee email "${r.email}" not found — row skipped` });
        skipped++;
        return false;
      }
      const assigneeId = r.email ? userByEmail.get(r.email) : undefined;
      if (assigneeId && !allocatedUserIds.has(assigneeId)) {
        errors.push({ row: r.rowNum, message: `Assignee "${r.email}" is not allocated to this project — row skipped` });
        skipped++;
        return false;
      }
      return true;
    });
    // Subtask rows are capped by their parent's estimate. Parent links are only
    // resolved after the rows are written, so the check runs here against the
    // file itself: the ceiling is the parent row's Plan Hours when this file
    // contains that parent, otherwise the existing task of the same title. Rows
    // are walked in file order and the ones that push the total over are skipped
    // with a normal row-level error — one bad row never fails the whole file.
    const withinParentCeiling = (() => {
      const ceilings = new Map<string, number | null>();
      const ceilingFor = (parentTitle: string): number | null => {
        if (ceilings.has(parentTitle)) return ceilings.get(parentTitle) ?? null;
        const parentRow = creatableRows.find((r) => r.data.title === parentTitle);
        const ceiling = parentRow
          ? resolveEffortHours(parentRow.data)
          : resolveEffortHours(existingTasks.find((t) => t.title === parentTitle));
        ceilings.set(parentTitle, ceiling);
        return ceiling;
      };

      const used = new Map<string, number>();
      const kept: typeof creatableRows = [];
      for (const row of creatableRows) {
        if (row.wbsLevel !== 'SUBTASK' || !row.parentTitle) {
          kept.push(row);
          continue;
        }
        const running = used.get(row.parentTitle) ?? 0;
        const result = checkSubtaskEffortCeiling({
          parentEffort: ceilingFor(row.parentTitle),
          siblingTotal: running,
          incomingEffort: resolveEffortHours(row.data),
        });
        if (result.over) {
          errors.push({
            row: row.rowNum,
            message:
              `Subtask Plan Hours cannot exceed the parent task estimate — parent "${row.parentTitle}" is ` +
              `${formatHours(result.ceiling as number)}h, this row takes the subtasks to ${formatHours(result.total)}h — skipped`,
          });
          skipped++;
          continue;
        }
        used.set(row.parentTitle, result.total);
        kept.push(row);
      }
      return kept;
    })();

    // File rows define their own title→level (overrides existing tasks of same title).
    withinParentCeiling.forEach((r) => titleToLevel.set(r.data.title, r.wbsLevel || ''));

    // One holiday fetch per file — covers every row's plan window (see daily-effort.util.ts).
    const holidayDates = await this.loadHolidayDatesForWindows(
      withinParentCeiling.map((r) => ({
        start: r.data.plannedStart,
        end: r.data.plannedEnd,
      })),
    );

    // ── Pass B: create tasks (then link parents) inside a transaction ────────
    let imported = 0;
    // Collected inside the transaction, notified after it commits: one digest per
    // assignee rather than one mail per imported row.
    const importedTasksByAssignee = new Map<string, string[]>();
    await this.prisma.$transaction(async (tx) => {
      // Tag every task this upload creates so a later "undo" can delete ONLY
      // these tasks — never manual/pre-existing ones (mirrors BulkUploadBatch).
      const batch = await tx.taskUploadBatch.create({
        data: { projectId, uploadedById: user.id, fileName: file.originalname },
      });

      const created: { id: string; rowNum: number; wbsLevel: string; parentTitle: string }[] = [];

      for (const r of withinParentCeiling) {
        // `creatableRows` already dropped rows with blank/unresolved emails, so this is always resolved.
        const assigneeId = userByEmail.get(r.email)!;
        const dedupKey = dedupKeyOf(r.parentTitle || '', r.data.title, assigneeId);
        if (dedupSeen.has(dedupKey)) {
          const parentLabel = r.parentTitle ? ` under "${r.parentTitle}"` : '';
          const message = dedupExisting.has(dedupKey)
            ? `Task "${r.data.title}"${parentLabel} is already assigned to this user in this project — skipped`
            : `Duplicate row for task "${r.data.title}"${parentLabel} with the same assignee — skipped, first occurrence used`;
          errors.push({ row: r.rowNum, message });
          skipped++;
          continue;
        }
        dedupSeen.add(dedupKey);

        const skillIds = r.skillNames
          .map((n) => skillByName.get(n.toLowerCase()))
          .filter((id): id is string => !!id);
        const unknownSkills = r.skillNames.filter((n) => !skillByName.has(n.toLowerCase()));
        if (unknownSkills.length) {
          errors.push({ row: r.rowNum, message: `Unknown skill(s) ignored: ${unknownSkills.join(', ')}` });
        }

        const taskTypeMasterId = r.taskTypeName
          ? taskTypeByName.get(r.taskTypeName.toLowerCase())
          : undefined;
        if (r.taskTypeName && !taskTypeMasterId) {
          errors.push({ row: r.rowNum, message: `Task type "${r.taskTypeName}" not found — task created without a type` });
        }

        const { complexity: rowComplexity, ...rowData } = r.data;
        const task = await tx.task.create({
          data: {
            ...rowData,
            // Subtasks carry no complexity of their own — leave the column default.
            ...(r.wbsLevel === 'SUBTASK' ? {} : { complexity: rowComplexity }),
            projectId,
            assigneeId,
            taskTypeMasterId: taskTypeMasterId ?? undefined,
            ...this.dailyEffortFields(r.data.plannedHours, r.data.plannedStart, r.data.plannedEnd, holidayDates),
            uploadBatchId: batch.id,
            ...(skillIds.length ? { skills: { create: skillIds.map((skillId) => ({ skillId })) } } : {}),
          },
          select: { id: true, title: true },
        });
        titleToId.set(task.title, task.id);
        created.push({ id: task.id, rowNum: r.rowNum, wbsLevel: r.wbsLevel, parentTitle: r.parentTitle });
        importedTasksByAssignee.set(assigneeId, [
          ...(importedTasksByAssignee.get(assigneeId) ?? []),
          task.id,
        ]);
        imported++;
      }

      // Link parents by title (within-file rows take precedence, then existing tasks).
      for (const c of created) {
        if (!c.parentTitle) continue;
        const parentId = titleToId.get(c.parentTitle);
        if (!parentId || parentId === c.id) {
          errors.push({ row: c.rowNum, message: `Parent "${c.parentTitle}" not found — left at root` });
          continue;
        }
        const parentLevel = titleToLevel.get(c.parentTitle);
        // Nothing may nest under a SUBTASK.
        if (parentLevel === 'SUBTASK') {
          errors.push({ row: c.rowNum, message: `Parent "${c.parentTitle}" is a SUBTASK — cannot nest under it; left at root` });
          continue;
        }
        // A SUBTASK's parent must be a TASK.
        if (c.wbsLevel === 'SUBTASK' && parentLevel !== 'TASK') {
          errors.push({ row: c.rowNum, message: `A SUBTASK's parent must be a TASK (parent "${c.parentTitle}" is ${parentLevel || 'unspecified'}); left at root` });
          continue;
        }
        await tx.task.update({ where: { id: c.id }, data: { parentId } });
      }

      await tx.taskUploadBatch.update({
        where: { id: batch.id },
        data: { importedCount: imported, skippedCount: skipped, errorCount: errors.length, errors },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'IMPORT',
        module: 'TASKS',
        entityId: projectId,
        userId: user.id,
        after: { imported, skipped, errorCount: errors.length } as any,
      },
    }).catch(() => {});

    for (const [assigneeId, taskIds] of importedTasksByAssignee) {
      await this.notifyAssignees(taskIds, [assigneeId], user.id);
    }

    return { imported, skipped, errors };
  }

  /** Paginated WBS upload history for a project, newest first — powers the undo UI. */
  async getWbsUploadHistory(projectId: string, query: QueryTaskUploadHistoryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.taskUploadBatch.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          fileName: true,
          importedCount: true,
          skippedCount: true,
          errorCount: true,
          status: true,
          createdAt: true,
          rolledBackAt: true,
          uploadedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.taskUploadBatch.count({ where: { projectId } }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Row-level errors for one WBS upload batch (fetched on demand from the History grid). */
  async getWbsUploadErrors(batchId: string) {
    const batch = await this.prisma.taskUploadBatch.findUnique({
      where: { id: batchId },
      select: { errors: true },
    });
    if (!batch) throw new NotFoundException('WBS upload not found');
    return { batchId, errors: (batch.errors as { row: number; message: string }[] | null) ?? [] };
  }

  /**
   * Undo a WBS upload: delete ONLY the tasks this batch created (untagged/manual
   * tasks are never touched). Blocked outright if any of those tasks already have
   * logged timesheet hours — deleting would otherwise silently null out `taskId`
   * on those entries (the FK is ON DELETE SET NULL) and orphan real logged time.
   */
  async undoWbsUpload(batchId: string, user: { id: string; role: string }) {
    if (!['ADMIN', 'PM', 'TL'].includes(user.role)) {
      throw new ForbiddenException('Only PMs, TLs, and Admins can undo a WBS import');
    }

    const batch = await this.prisma.taskUploadBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Upload not found');
    if (batch.status === 'ROLLED_BACK') {
      throw new BadRequestException('This upload has already been undone');
    }

    const tasks = await this.prisma.task.findMany({
      where: { uploadBatchId: batchId },
      select: { id: true, title: true },
    });
    const taskIds = tasks.map((t) => t.id);

    const entries = await this.prisma.timesheetEntry.findMany({
      where: { taskId: { in: taskIds } },
      select: {
        taskId: true,
        hours: true,
        timesheet: {
          select: {
            user: { select: { firstName: true, lastName: true, email: true } },
            freelancer: { select: { fullName: true } },
          },
        },
      },
    });

    if (entries.length > 0) {
      const titleById = new Map(tasks.map((t) => [t.id, t.title]));
      const totals = new Map<string, { taskTitle: string; personName: string; totalHours: number }>();
      for (const e of entries) {
        const personName = e.timesheet.user
          ? `${e.timesheet.user.firstName ?? ''} ${e.timesheet.user.lastName ?? ''}`.trim() || e.timesheet.user.email
          : e.timesheet.freelancer?.fullName ?? 'Unknown';
        const taskTitle = titleById.get(e.taskId!) ?? 'Unknown task';
        const key = `${e.taskId}::${personName}`;
        const existing = totals.get(key);
        totals.set(key, { taskTitle, personName, totalHours: (existing?.totalHours ?? 0) + e.hours });
      }
      throw new BadRequestException({
        message: 'Cannot undo — time has already been logged against these tasks',
        blockers: [...totals.values()],
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { uploadBatchId: batchId } });
      await tx.taskUploadBatch.update({
        where: { id: batchId },
        data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
      });
    });

    return { deletedTasks: taskIds.length };
  }

  /**
   * Build a styled .xlsx template for the global Task Board bulk upload. Mirrors
   * the "Create Task" modal: Title, Description, Start/End dates, Planned
   * Start/End dates, Project, Priority, Status, Task Type, Assignees, Estimated
   * Effort. Project / Priority / Status / Task Type get in-cell dropdowns whose
   * values are pulled live from the DB (a hidden "Lists" sheet). Also emits an
   * "Instructions" sheet documenting every column.
   */
  async generateTaskTemplate(): Promise<Buffer> {
    const [projects, taskTypes, allocations] = await Promise.all([
      this.prisma.project.findMany({ select: { id: true, name: true, projectCode: true }, orderBy: { name: 'asc' } }),
      this.prisma.taskTypeMaster.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: 'asc' } }),
      // Project membership = allocations (mirrors the Create Task modal, which only
      // lets you assign users allocated to the chosen project). Drives the cascading
      // Assignees dropdown so it shows only that project's allocated users.
      this.prisma.allocation.findMany({
        where: { userId: { not: null }, user: { isActive: true } },
        select: {
          projectId: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
    ]);
    // Project names are NOT unique in the DB. Where a name is shared by more than
    // one project, disambiguate the dropdown value with a suffix — the project
    // code when present, else a short id — e.g. "Process Dashboard [PRJ-001]".
    // The importer parses this suffix back to the exact project (see bulkUploadTasks).
    const nameCounts = new Map<string, number>();
    projects.forEach((p) => {
      const k = (p.name ?? '').trim().toLowerCase();
      nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
    });
    const projectDisplay = (p: { id: string; name: string; projectCode: string | null }) => {
      const isDup = (nameCounts.get((p.name ?? '').trim().toLowerCase()) ?? 0) > 1;
      if (!isDup) return p.name;
      const suffix = p.projectCode?.trim() || p.id.slice(0, 8);
      return `${p.name} [${suffix}]`;
    };
    const projectNames = projects.map(projectDisplay).filter(Boolean);
    const taskTypeNames = taskTypes.map((t) => t.name).filter(Boolean);

    // Display an assignee as "First Last <email>" (falls back to just the email
    // when the user has no name). The importer parses the email back out.
    const assigneeDisplay = (u: { firstName: string | null; lastName: string | null; email: string }) => {
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
      return name ? `${name} <${u.email}>` : u.email;
    };
    // projectId → sorted, de-duplicated list of "Name <email>" for its allocated users.
    const membersByProject = new Map<string, string[]>();
    allocations.forEach((a) => {
      if (!a.user) return;
      const list = membersByProject.get(a.projectId) ?? [];
      const label = assigneeDisplay(a.user);
      if (!list.includes(label)) list.push(label);
      membersByProject.set(a.projectId, list);
    });
    membersByProject.forEach((list) => list.sort((x, y) => x.localeCompare(y)));
    // One matrix column per project (same order as projectNames), header = the
    // exact Project dropdown value, members listed beneath — feeds the cascading
    // Assignees dropdown via OFFSET/MATCH on the row's chosen Project.
    const projectMemberColumns = projects.map((p) => ({
      header: projectDisplay(p) ?? '',
      members: membersByProject.get(p.id) ?? [],
    }));

    const BRAND = 'FF1F3A5F';
    const BRAND_DARK = 'FF14243B';
    const BASE_FONT = { name: 'Calibri', size: 11 } as const;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Newel Planner';

    // ── Main "Tasks" sheet ───────────────────────────────────────────────
    const sheet = workbook.addWorksheet('Tasks', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = TASK_COLUMNS.map((c) => ({
      header: c.header + (c.required ? ' *' : ''),
      key: c.key,
      width: Math.max(c.header.length + 5, 18),
      style: { font: { ...BASE_FONT } },
    }));

    // Styled header row.
    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      cell.font = { ...BASE_FONT, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = { bottom: { style: 'thin', color: { argb: BRAND_DARK } } };
    });

    // Date + number formats.
    ['startdate', 'enddate', 'plannedstart', 'plannedend'].forEach((k) => {
      sheet.getColumn(k).numFmt = 'yyyy-mm-dd';
    });
    sheet.getColumn('effort').numFmt = '0.##';

    // A single pre-filled example row (row 2 of the Tasks sheet). Pick a project
    // that actually has allocated members so the Project + Assignees example is
    // internally consistent; fall back to the first project / a placeholder.
    const exampleColumn = projectMemberColumns.find((c) => c.members.length);
    const exampleValues: Record<string, string> = {
      Title: 'Login feature',
      Description: 'Build the login experience',
      'Start Date': '2026-07-15',
      'End Date': '2026-07-30',
      'Planned Start Date': '2026-07-15',
      'Planned End Date': '2026-07-28',
      Project: exampleColumn?.header || projectNames[0] || 'Customer Portal v2',
      Priority: 'High',
      Status: 'Backlog',
      'Task Type': taskTypeNames[0] ?? '(any active task type)',
      Assignees: exampleColumn?.members[0] || 'Jane Doe <jane@example.com>',
      'Estimated Effort (Hours)': '40',
    };
    // Pre-fill row 2 with the example so the user has a ready-made format to copy.
    const exampleRow = sheet.getRow(2);
    TASK_COLUMNS.forEach((c, i) => {
      exampleRow.getCell(i + 1).value = exampleValues[c.header] ?? '';
    });

    // ── Hidden "Lists" sheet feeding the dropdowns ───────────────────────
    const lists = workbook.addWorksheet('Lists', { state: 'hidden' });
    const listCols = [
      { title: 'Projects', values: projectNames },
      { title: 'Task Types', values: taskTypeNames },
      { title: 'Priorities', values: TASK_PRIORITIES },
      { title: 'Statuses', values: TASK_STATUSES },
    ];
    listCols.forEach((lc, i) => {
      const col = lists.getColumn(i + 1);
      col.width = 28;
      lists.getCell(1, i + 1).value = lc.title;
      lc.values.forEach((v, r) => (lists.getCell(r + 2, i + 1).value = v));
    });

    // Project → allocated-members matrix. One column per project starting at
    // MATRIX_START_COL; members ("Name <email>") listed from row 2 down. Each
    // project's member range is registered as a named range (pm_1, pm_2, …) so the
    // Assignees dropdown can resolve the row's chosen Project to its members via
    // INDIRECT — the dependent-dropdown technique that works in both Excel and WPS.
    const MATRIX_START_COL = listCols.length + 2; // leave a spacer column
    projectMemberColumns.forEach((pc, i) => {
      const colNum = MATRIX_START_COL + i;
      const col = lists.getColumn(colNum);
      col.width = 34;
      lists.getCell(1, colNum).value = pc.header;
      pc.members.forEach((m, r) => (lists.getCell(r + 2, colNum).value = m));
      const letter = lists.getColumn(colNum).letter;
      // Range covers exactly the member rows (2 .. 1+count) so there are no
      // trailing blanks. Member-less projects point at a single empty cell.
      const lastRow = pc.members.length > 0 ? pc.members.length + 1 : 2;
      workbook.definedNames.add(`Lists!$${letter}$2:$${letter}$${lastRow}`, `pm_${i + 1}`);
    });

    // Attach list validations to rows 2..1000 of the given column.
    const colLetter = (key: string) => {
      const idx = TASK_COLUMNS.findIndex((c) => c.key === key) + 1;
      return sheet.getColumn(idx).letter;
    };
    const listRange = (listColIdx: number, count: number) => {
      const letter = lists.getColumn(listColIdx).letter;
      const last = Math.max(count + 1, 2);
      return `Lists!$${letter}$2:$${letter}$${last}`;
    };
    const addDropdown = (key: string, listColIdx: number, count: number) => {
      const letter = colLetter(key);
      for (let r = 2; r <= 1000; r++) {
        sheet.getCell(`${letter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [listRange(listColIdx, count)],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Value not in list',
          error: 'Pick a value from the dropdown. Other values may be rejected on import.',
        };
      }
    };
    addDropdown('project', 1, projectNames.length);
    addDropdown('tasktype', 2, taskTypeNames.length);
    addDropdown('priority', 3, TASK_PRIORITIES.length);
    addDropdown('status', 4, TASK_STATUSES.length);
    // Assignees is a CASCADING dropdown: its options are scoped to the users
    // allocated to the Project chosen in the same row (mirrors the Create Task
    // modal). It's a single-value picker — for multiple people, type a
    // comma-separated list of the "Name <email>" entries. The list formula finds
    // the row's Project position in the Projects list (Lists column A) and resolves
    // the matching named range (pm_1, pm_2, …) via INDIRECT. Unallocated/unknown
    // picks are skipped with a warning on import.
    if (projectMemberColumns.length) {
      const projLetter = colLetter('project');
      const asgLetter = colLetter('assignees');
      const projListLast = projectNames.length + 1; // Lists!A2:A<last>
      for (let r = 2; r <= 1000; r++) {
        const idx = `MATCH($${projLetter}${r},Lists!$A$2:$A$${projListLast},0)`;
        const formula = `INDIRECT("pm_"&${idx})`;
        sheet.getCell(`${asgLetter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Value not in list',
          error: 'Pick an assignee from the dropdown after choosing a Project. Others may be skipped on import.',
        };
      }
    }

    // Date columns: Excel can't show a true calendar popup in a plain .xlsx, but a
    // date-type validation enforces real dates and shows a helper tooltip on click.
    const addDateValidation = (key: string) => {
      const letter = colLetter(key);
      for (let r = 2; r <= 1000; r++) {
        sheet.getCell(`${letter}${r}`).dataValidation = {
          type: 'date',
          operator: 'greaterThanOrEqual',
          allowBlank: true,
          formulae: [new Date(2000, 0, 1)],
          showInputMessage: true,
          promptTitle: 'Enter a date',
          prompt: 'Type a date in YYYY-MM-DD format (e.g. 2026-07-15).',
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid date',
          error: 'Please enter a valid date in YYYY-MM-DD format.',
        };
      }
    };
    ['startdate', 'enddate', 'plannedstart', 'plannedend'].forEach(addDateValidation);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Parse an uploaded .xlsx/.csv of tasks (Task Board bulk upload) and create
   * them across projects. Validates per row and returns { imported, skipped,
   * errors } so the caller can show a row-by-row report. Valid rows import even
   * when others fail; unknown/unallocated assignee emails are dropped with a
   * warning rather than failing the whole row.
   */
  async bulkUploadTasks(
    file: Express.Multer.File,
    user: { id: string; role: string },
  ): Promise<{ batchId?: string; imported: number; skipped: number; errors: { row: number; message: string }[] }> {
    if (!['ADMIN', 'PM', 'TL'].includes(user.role)) {
      throw new ForbiddenException('Only PMs, TLs, and Admins can import tasks');
    }

    // ── Parse the workbook (.csv via stream, .xlsx via buffer load) ──────────
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

    const worksheet = workbook.getWorksheet('Tasks') ?? workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File contains no worksheets.');

    // ── Map headers → column index (case-insensitive, ignores non-alphanumerics) ──
    const normalise = (s: unknown) => (s ?? '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    // Also match the trailing " *" markers on required headers.
    const headerAliases: Record<string, string> = {
      estimatedeffort: 'effort', estimatedefforthours: 'effort', effort: 'effort', efforthours: 'effort',
      plannedstartdate: 'plannedstart', plannedenddate: 'plannedend',
      startdate: 'startdate', enddate: 'enddate',
    };
    const headerRow = worksheet.getRow(1).values as any[];
    const colIndex: Record<string, number> = {};
    headerRow.forEach((h, i) => {
      if (!h) return;
      const key = normalise(h);
      colIndex[headerAliases[key] ?? key] = i;
    });
    if (colIndex['title'] === undefined) throw new BadRequestException('Missing required column "Title".');
    if (colIndex['project'] === undefined) throw new BadRequestException('Missing required column "Project".');

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

    // ── Pre-load reference data (one query each) ─────────────────────────────
    const [projects, taskTypes] = await Promise.all([
      this.prisma.project.findMany({ select: { id: true, name: true, projectCode: true } }),
      this.prisma.taskTypeMaster.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);
    // Names aren't unique, so map each name → all matching project ids (to detect
    // ambiguity), plus lookups by project code and id-prefix for the disambiguated
    // "Name [CODE]" / "Name [id]" form the template emits for duplicated names.
    const projectIdsByName = new Map<string, string[]>();
    const projectByCode = new Map<string, string>();
    projects.forEach((p) => {
      const key = norm(p.name);
      const list = projectIdsByName.get(key) ?? [];
      list.push(p.id);
      projectIdsByName.set(key, list);
      if (p.projectCode) projectByCode.set(norm(p.projectCode), p.id);
    });
    // Resolve a Project cell to a single id. Returns { id } or { error }.
    const resolveProject = (raw: string): { id?: string; error?: string } => {
      const bracket = raw.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
      if (bracket) {
        const suffix = bracket[2].trim();
        const byCode = projectByCode.get(norm(suffix));
        if (byCode) return { id: byCode };
        const byId = projects.find((p) => p.id.toLowerCase().startsWith(suffix.toLowerCase()));
        if (byId) return { id: byId.id };
        return { error: `Project "${raw}" not found` };
      }
      const ids = projectIdsByName.get(norm(raw)) ?? [];
      if (ids.length === 0) return { error: `Project "${raw}" not found` };
      if (ids.length > 1) {
        return {
          error: `Project name "${raw}" is ambiguous — ${ids.length} projects share this name. Re-download the template and pick the entry with the code in brackets (e.g. "${raw} [CODE]").`,
        };
      }
      return { id: ids[0] };
    };
    const taskTypeByName = new Map<string, string>();
    taskTypes.forEach((t) => taskTypeByName.set(norm(t.name), t.id));

    const errors: { row: number; message: string }[] = [];
    let skipped = 0;

    type ParsedRow = {
      rowNum: number;
      projectId: string;
      emails: string[];
      data: {
        title: string;
        description?: string;
        status: string;
        priority: string;
        taskTypeMasterId?: string;
        estimatedEffort?: number;
        startDate: Date;
        endDate: Date;
        plannedStart?: Date;
        plannedEnd?: Date;
      };
    };
    const parsedRows: ParsedRow[] = [];
    const emailsToResolve = new Set<string>();
    // Within-file duplicate detection (Title + Project, normalized) — maps the
    // dedup key to the row it was first seen on. A Map lookup, so this scales
    // linearly with file size regardless of how many rows the file has.
    const seenRowKeys = new Map<string, number>();

    // ── Pass A: validate & parse every data row ──────────────────────────────
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const title = cell(row, 'title');
      const description = cell(row, 'description');
      const startRaw = cell(row, 'startdate');
      const endRaw = cell(row, 'enddate');
      const pStartRaw = cell(row, 'plannedstart');
      const pEndRaw = cell(row, 'plannedend');
      const projectRaw = cell(row, 'project');
      const priorityRaw = cell(row, 'priority');
      const statusRaw = cell(row, 'status');
      const taskTypeRaw = cell(row, 'tasktype');
      const assigneesRaw = cell(row, 'assignees');
      const effortRaw = cell(row, 'effort');

      // Skip fully blank rows silently.
      if (![title, description, startRaw, endRaw, pStartRaw, pEndRaw, projectRaw, priorityRaw, statusRaw, taskTypeRaw, assigneesRaw, effortRaw].some((v) => v)) {
        continue;
      }

      const rowErrors: string[] = [];
      if (!title) rowErrors.push('Title is required');

      // Project (required). Handles duplicate names via the "Name [CODE]" suffix.
      let projectId = '';
      if (!projectRaw) {
        rowErrors.push('Project is required');
      } else {
        const resolved = resolveProject(projectRaw);
        if (resolved.error) rowErrors.push(resolved.error);
        else projectId = resolved.id!;
      }

      // Priority / Status (map labels → enum; default when blank).
      let priority = 'MEDIUM';
      if (priorityRaw) {
        const mapped = TASK_PRIORITY_MAP[norm(priorityRaw)];
        if (!mapped) rowErrors.push(`Invalid Priority "${priorityRaw}"`);
        else priority = mapped;
      }
      let status = 'BACKLOG';
      if (statusRaw) {
        const mapped = TASK_STATUS_MAP[norm(statusRaw)];
        if (!mapped) rowErrors.push(`Invalid Status "${statusRaw}"`);
        else status = mapped;
      }

      // Task Type (optional).
      let taskTypeMasterId: string | undefined;
      if (taskTypeRaw) {
        const ttId = taskTypeByName.get(norm(taskTypeRaw));
        if (!ttId) rowErrors.push(`Task Type "${taskTypeRaw}" not found or inactive`);
        else taskTypeMasterId = ttId;
      }

      // Dates (Start & End required).
      const startDate = startRaw ? new Date(startRaw) : undefined;
      const endDate = endRaw ? new Date(endRaw) : undefined;
      if (!startRaw) rowErrors.push('Start Date is required');
      else if (isNaN(startDate!.getTime())) rowErrors.push('Invalid Start Date');
      if (!endRaw) rowErrors.push('End Date is required');
      else if (isNaN(endDate!.getTime())) rowErrors.push('Invalid End Date');
      if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate < startDate) {
        rowErrors.push('End Date cannot be before Start Date');
      }

      const plannedStart = pStartRaw ? new Date(pStartRaw) : undefined;
      const plannedEnd = pEndRaw ? new Date(pEndRaw) : undefined;
      if (pStartRaw && isNaN(plannedStart!.getTime())) rowErrors.push('Invalid Planned Start Date');
      if (pEndRaw && isNaN(plannedEnd!.getTime())) rowErrors.push('Invalid Planned End Date');
      if (plannedStart && plannedEnd && !isNaN(plannedStart.getTime()) && !isNaN(plannedEnd.getTime()) && plannedEnd < plannedStart) {
        rowErrors.push('Planned End cannot be before Planned Start');
      }

      // Estimated effort (optional, > 0).
      let estimatedEffort: number | undefined;
      if (effortRaw) {
        estimatedEffort = Number(effortRaw);
        if (isNaN(estimatedEffort) || estimatedEffort <= 0) rowErrors.push('Estimated Effort must be a number greater than 0');
      }

      // Accept the template's "Name <email>" dropdown entries as well as plain,
      // comma-separated emails. Extract the address from each segment.
      const emails = assigneesRaw
        ? assigneesRaw
            .split(',')
            .map((seg) => {
              const angle = seg.match(/<([^>]+)>/);
              if (angle) return angle[1].trim().toLowerCase();
              const at = seg.match(/[^\s,;<>]+@[^\s,;<>]+/);
              if (at) return at[0].trim().toLowerCase();
              return seg.trim().toLowerCase();
            })
            .filter(Boolean)
        : [];

      // Duplicate detection (Title + Project, normalized) — only meaningful once
      // Title and Project have both resolved cleanly above.
      if (!rowErrors.length) {
        const dupKey = `${projectId}::${norm(title)}`;
        const firstRow = seenRowKeys.get(dupKey);
        if (firstRow) {
          rowErrors.push(`Duplicate task — "${title}" already appears in this file at row ${firstRow} for the same project`);
        } else {
          seenRowKeys.set(dupKey, rowNum);
        }
      }

      if (rowErrors.length) {
        errors.push({ row: rowNum, message: rowErrors.join('; ') });
        skipped++;
        continue;
      }

      emails.forEach((e) => emailsToResolve.add(e));
      parsedRows.push({
        rowNum,
        projectId,
        emails,
        data: {
          title,
          description: description || undefined,
          status,
          priority,
          taskTypeMasterId,
          estimatedEffort,
          startDate: startDate!,
          endDate: endDate!,
          plannedStart,
          plannedEnd,
        },
      });
    }

    if (!parsedRows.length) return { imported: 0, skipped, errors };

    // ── Cross-database duplicate detection (Title + Project, normalized) ─────
    // Scoped to only the (project, title) pairs actually present in this file —
    // never loads a project's full task list — so this stays cheap no matter
    // how many tasks already exist in a project.
    const titlesByProject = new Map<string, string[]>();
    for (const r of parsedRows) {
      const list = titlesByProject.get(r.projectId) ?? [];
      list.push(r.data.title);
      titlesByProject.set(r.projectId, list);
    }
    const existingTasks = titlesByProject.size
      ? await this.prisma.task.findMany({
          where: {
            OR: [...titlesByProject.entries()].map(([projectId, titles]) => ({
              projectId,
              title: { in: titles, mode: 'insensitive' as const },
            })),
          },
          select: { projectId: true, title: true },
        })
      : [];
    if (existingTasks.length) {
      const existingKeys = new Set(existingTasks.map((t) => `${t.projectId}::${norm(t.title)}`));
      for (let i = parsedRows.length - 1; i >= 0; i--) {
        const r = parsedRows[i];
        if (existingKeys.has(`${r.projectId}::${norm(r.data.title)}`)) {
          errors.push({ row: r.rowNum, message: `Duplicate task — a task titled "${r.data.title}" already exists in this project` });
          skipped++;
          parsedRows.splice(i, 1);
        }
      }
    }
    if (!parsedRows.length) return { imported: 0, skipped, errors };

    // ── Resolve assignee emails → ids, then which are allocated per project ──
    const userByEmail = new Map<string, string>();
    if (emailsToResolve.size) {
      const found = await this.prisma.user.findMany({
        where: { email: { in: [...emailsToResolve], mode: 'insensitive' }, isActive: true },
        select: { id: true, email: true },
      });
      found.forEach((u) => userByEmail.set(u.email.toLowerCase(), u.id));
    }
    // Allocation lookup keyed by `${projectId}:${userId}`.
    const allocatedPairs = new Set<string>();
    const userIds = [...new Set([...userByEmail.values()])];
    const projectIds = [...new Set(parsedRows.map((r) => r.projectId))];
    if (userIds.length && projectIds.length) {
      const allocations = await this.prisma.allocation.findMany({
        where: { projectId: { in: projectIds }, userId: { in: userIds } },
        select: { projectId: true, userId: true },
      });
      allocations.forEach((a) => allocatedPairs.add(`${a.projectId}:${a.userId}`));
    }

    // One holiday fetch per file — covers every row's effort window.
    const holidayDates = await this.loadHolidayDatesForWindows(
      parsedRows.map((r) => ({
        start: r.data.startDate ?? r.data.plannedStart,
        end: r.data.endDate ?? r.data.plannedEnd,
      })),
    );

    // ── Pass B: create tasks inside a transaction ────────────────────────────
    let imported = 0;
    // Collected inside the transaction, notified after it commits: one digest per
    // assignee rather than one mail per imported row.
    const importedTasksByAssignee = new Map<string, string[]>();
    let batchId: string | undefined;
    await this.prisma.$transaction(async (tx) => {
      // Tag every task this upload creates so a later "undo" can delete ONLY
      // these tasks — never manual/pre-existing ones (mirrors TaskUploadBatch).
      const batch = await tx.taskBulkUploadBatch.create({
        data: { uploadedById: user.id, fileName: file.originalname },
      });
      batchId = batch.id;

      for (const r of parsedRows) {
        const validAssigneeIds: string[] = [];
        for (const email of r.emails) {
          const uid = userByEmail.get(email);
          if (!uid) {
            errors.push({ row: r.rowNum, message: `Assignee "${email}" not found — skipped` });
            continue;
          }
          if (!allocatedPairs.has(`${r.projectId}:${uid}`)) {
            errors.push({ row: r.rowNum, message: `Assignee "${email}" is not allocated to this project — skipped` });
            continue;
          }
          if (!validAssigneeIds.includes(uid)) validAssigneeIds.push(uid);
        }

        const createdTask = await tx.task.create({
          data: {
            ...r.data,
            projectId: r.projectId,
            createdById: user.id,
            assigneeId: validAssigneeIds[0],
            ...this.dailyEffortFields(r.data.estimatedEffort, r.data.startDate ?? r.data.plannedStart, r.data.endDate ?? r.data.plannedEnd, holidayDates),
            bulkUploadBatchId: batch.id,
            ...(validAssigneeIds.length
              ? { taskAssignees: { create: validAssigneeIds.map((userId) => ({ userId })) } }
              : {}),
          },
          select: { id: true },
        });
        for (const assigneeId of validAssigneeIds) {
          importedTasksByAssignee.set(assigneeId, [
            ...(importedTasksByAssignee.get(assigneeId) ?? []),
            createdTask.id,
          ]);
        }
        imported++;
      }

      await tx.taskBulkUploadBatch.update({
        where: { id: batch.id },
        data: { importedCount: imported, skippedCount: skipped, errorCount: errors.length, errors },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'IMPORT',
        module: 'TASKS',
        entityId: null,
        userId: user.id,
        after: { imported, skipped, errorCount: errors.length } as any,
      },
    }).catch(() => {});

    for (const [assigneeId, taskIds] of importedTasksByAssignee) {
      await this.notifyAssignees(taskIds, [assigneeId], user.id);
    }

    return { batchId, imported, skipped, errors };
  }

  /** Paginated Task Board bulk-upload history, newest first — powers the View History tab. */
  async getBulkUploadHistory(query: QueryTaskBulkUploadHistoryDto) {
    const { page = 1, pageSize = 10 } = query;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.taskBulkUploadBatch.findMany({
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
          uploadedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.taskBulkUploadBatch.count(),
    ]);

    return { data, total, page, pageSize };
  }

  /** Row-level errors for one Task Board bulk-upload batch (fetched on demand from the History grid). */
  async getBulkUploadErrors(batchId: string) {
    const batch = await this.prisma.taskBulkUploadBatch.findUnique({
      where: { id: batchId },
      select: { errors: true },
    });
    if (!batch) throw new NotFoundException('Bulk upload not found');
    return { batchId, errors: (batch.errors as { row: number; message: string }[] | null) ?? [] };
  }

  /**
   * Undo a Task Board bulk upload: delete ONLY the tasks this batch created
   * (untagged/manual tasks are never touched). Blocked outright if any of those
   * tasks already have logged timesheet hours — deleting would otherwise silently
   * null out `taskId` on those entries (the FK is ON DELETE SET NULL) and orphan
   * real logged time.
   */
  async undoBulkUpload(batchId: string, user: { id: string; role: string }) {
    if (!['ADMIN', 'PM', 'TL'].includes(user.role)) {
      throw new ForbiddenException('Only PMs, TLs, and Admins can undo a bulk import');
    }

    const batch = await this.prisma.taskBulkUploadBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Upload not found');
    if (batch.status === 'ROLLED_BACK') {
      throw new BadRequestException('This upload has already been undone');
    }

    const tasks = await this.prisma.task.findMany({
      where: { bulkUploadBatchId: batchId },
      select: { id: true, title: true },
    });
    const taskIds = tasks.map((t) => t.id);

    const entries = await this.prisma.timesheetEntry.findMany({
      where: { taskId: { in: taskIds } },
      select: {
        taskId: true,
        hours: true,
        timesheet: {
          select: {
            user: { select: { firstName: true, lastName: true, email: true } },
            freelancer: { select: { fullName: true } },
          },
        },
      },
    });

    if (entries.length > 0) {
      const titleById = new Map(tasks.map((t) => [t.id, t.title]));
      const totals = new Map<string, { taskTitle: string; personName: string; totalHours: number }>();
      for (const e of entries) {
        const personName = e.timesheet.user
          ? `${e.timesheet.user.firstName ?? ''} ${e.timesheet.user.lastName ?? ''}`.trim() || e.timesheet.user.email
          : e.timesheet.freelancer?.fullName ?? 'Unknown';
        const taskTitle = titleById.get(e.taskId!) ?? 'Unknown task';
        const key = `${e.taskId}::${personName}`;
        const existing = totals.get(key);
        totals.set(key, { taskTitle, personName, totalHours: (existing?.totalHours ?? 0) + e.hours });
      }
      throw new BadRequestException({
        message: 'Cannot undo — time has already been logged against these tasks',
        blockers: [...totals.values()],
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { bulkUploadBatchId: batchId } });
      await tx.taskBulkUploadBatch.update({
        where: { id: batchId },
        data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
      });
    });

    return { deletedTasks: taskIds.length };
  }

  async create(createTaskDto: CreateTaskDto, user: { id: string; role: string }) {
    if (!['ADMIN', 'PM', 'TL'].includes(user.role)) {
      throw new ForbiddenException('Only PMs, TLs, and Admins can create tasks');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: createTaskDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createTaskDto.projectId} not found`);
    }

    if (createTaskDto.parentId) {
      const parentTask = await this.prisma.task.findUnique({
        where: { id: createTaskDto.parentId },
        select: { id: true, projectId: true, wbsLevel: true, startDate: true, endDate: true, sprintId: true },
      });
      if (!parentTask) {
        throw new NotFoundException(`Parent task with ID ${createTaskDto.parentId} not found`);
      }
      if (createTaskDto.projectId !== parentTask.projectId) {
        throw new BadRequestException('Subtask must belong to the same project as the parent task');
      }
      if (parentTask.wbsLevel === 'SUBTASK') {
        throw new BadRequestException('Cannot create subtasks under a SUBTASK-level task');
      }
      if (createTaskDto.startDate && parentTask.startDate && new Date(createTaskDto.startDate) < parentTask.startDate) {
        throw new BadRequestException(`Subtask start date cannot be before parent task start date (${parentTask.startDate.toISOString().substring(0, 10)})`);
      }
      if (createTaskDto.endDate && parentTask.endDate && new Date(createTaskDto.endDate) > parentTask.endDate) {
        throw new BadRequestException(`Subtask end date cannot exceed parent task end date (${parentTask.endDate.toISOString().substring(0, 10)})`);
      }
      if (createTaskDto.sprintId && parentTask.sprintId && createTaskDto.sprintId !== parentTask.sprintId) {
        throw new BadRequestException('Subtask must be in the same sprint as the parent task');
      }
    }

    // A Change Request belongs to the top-level task. Subtasks never carry one,
    // so skip the CR checks (and the APPROVED → IN_PROGRESS side effect) for
    // them; the value is dropped from the write further below.
    if (createTaskDto.crId && !createTaskDto.parentId) {
      const cr = await this.prisma.changeRequest.findUnique({ where: { id: createTaskDto.crId } });
      if (!cr) throw new NotFoundException(`Change Request ${createTaskDto.crId} not found`);
      if (cr.projectId !== createTaskDto.projectId) {
        throw new BadRequestException('Task projectId must match the Change Request projectId');
      }
      if (!['APPROVED', 'IN_PROGRESS'].includes(cr.status)) {
        throw new BadRequestException('Tasks can only be created against APPROVED or IN_PROGRESS Change Requests');
      }
      if (cr.status === 'APPROVED') {
        await this.prisma.changeRequest.update({ where: { id: cr.id }, data: { status: 'IN_PROGRESS' as any } });
      }
    }

    if (createTaskDto.taskTypeMasterId) {
      const taskTypeMaster = await this.prisma.taskTypeMaster.findUnique({
        where: { id: createTaskDto.taskTypeMasterId },
      });
      if (!taskTypeMaster) throw new NotFoundException(`Task type with ID ${createTaskDto.taskTypeMasterId} not found`);
      if (!taskTypeMaster.isActive) throw new BadRequestException('Selected task type is inactive');
    }

    const { skillIds, assigneeIds, ...taskData } = createTaskDto;

    if (createTaskDto.parentId) {
      // Subtasks own no Change Request, complexity or progress — the parent
      // carries those. Dropped from the write rather than force-cleared, so a
      // task written before these rules existed keeps whatever it already has.
      delete taskData.crId;
      delete taskData.phase;
      delete taskData.complexity;
      delete taskData.progressPct;

      // The subtasks together may not estimate more than the parent task.
      await this.assertSubtaskEffortWithinParent(
        createTaskDto.parentId,
        null,
        resolveEffortHours(taskData),
      );
    }

    // Multiple assignees (drawn from project allocations). Primary assigneeId is
    // kept in sync with the first entry unless one was passed explicitly.
    const uniqueAssigneeIds = assigneeIds ? [...new Set(assigneeIds)] : undefined;
    const assigneeIdsToValidate = uniqueAssigneeIds?.length
      ? uniqueAssigneeIds
      : taskData.assigneeId
        ? [taskData.assigneeId]
        : [];
    if (assigneeIdsToValidate.length) {
      await this.validateAssigneesAllocated(createTaskDto.projectId, assigneeIdsToValidate, user);
    }
    const primaryAssigneeId = taskData.assigneeId ?? uniqueAssigneeIds?.[0];

    // Derived hours/day — the estimate spread across the task's working days
    // (actual dates first, planned dates as fallback). A hand-typed value sent
    // with dailyEffortOverride=true wins over the derivation.
    const derived = await this.deriveTaskDailyEffort(taskData);
    const manualDailyEffort =
      taskData.dailyEffortOverride === true && typeof taskData.dailyEffort === 'number'
        ? taskData.dailyEffort
        : null;

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        dailyEffort: manualDailyEffort ?? derived.dailyEffort,
        dailyEffortOverride: manualDailyEffort != null,
        workingDays: derived.workingDays,
        assigneeId: primaryAssigneeId,
        createdById: user.id,
        startDate: taskData.startDate ? new Date(taskData.startDate) : undefined,
        endDate: taskData.endDate ? new Date(taskData.endDate) : undefined,
        plannedStart: taskData.plannedStart ? new Date(taskData.plannedStart) : undefined,
        plannedEnd: taskData.plannedEnd ? new Date(taskData.plannedEnd) : undefined,
        ...(skillIds?.length
          ? { skills: { create: skillIds.map((skillId) => ({ skillId })) } }
          : {}),
        ...(uniqueAssigneeIds?.length
          ? { taskAssignees: { create: uniqueAssigneeIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: {
        skills: { include: { skill: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        taskAssignees: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
        changeRequest: { select: { id: true, crCode: true, status: true } },
        taskTypeMaster: { select: { id: true, name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'CREATE',
        module: 'TASKS',
        entityId: task.id,
        userId: user.id,
        after: this.serializeTaskSnapshot(task),
      },
    }).catch(() => {});

    await this.notifyAssignees(
      [task.id],
      [primaryAssigneeId, ...(uniqueAssigneeIds ?? [])].filter(Boolean) as string[],
      user.id,
    );

    return task;
  }

  // Ensure each user is an allocated resource on the project before assigning.
  private async validateAssigneesAllocated(
    projectId: string,
    userIds: string[],
    _actor?: { id: string; role: string },
  ) {
    if (!userIds.length) return;
    const userWhere: any = { isActive: true };
    const allocations = await this.prisma.allocation.findMany({
      where: { projectId, userId: { in: userIds }, user: userWhere },
      select: { userId: true },
    });
    const allocated = new Set(allocations.map((a) => a.userId));
    const missing = userIds.filter((uid) => !allocated.has(uid));
    if (missing.length) {
      throw new BadRequestException(
        `User(s) not allocated to this project cannot be assigned: ${missing.join(', ')}`,
      );
    }
  }

  // ── Daily-effort derivation ───────────────────────────────────────────────
  // `dailyEffort` (hours per working day) spreads a task's effort across the
  // working days between its dates. Working days are Mon–Fri minus global,
  // non-optional public holidays — see daily-effort.util.ts.

  /** Holiday dates (`YYYY-MM-DD`) in [from, to] that push work off a weekday. */
  private async loadHolidayDates(from: Date, to: Date): Promise<Set<string>> {
    const holidays = await this.prisma.publicHoliday.findMany({
      where: { date: { gte: from, lte: to }, isOptional: false, isGlobal: true },
      select: { date: true },
    });
    return new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
  }

  /** One holiday query covering every window — imports call this once per file. */
  private async loadHolidayDatesForWindows(
    windows: { start: Date | null | undefined; end: Date | null | undefined }[],
  ): Promise<Set<string>> {
    const valid = windows.filter((w): w is { start: Date; end: Date } => !!w.start && !!w.end);
    if (!valid.length) return new Set();
    let from = valid[0].start;
    let to = valid[0].end;
    for (const w of valid) {
      if (w.start < from) from = w.start;
      if (w.end > to) to = w.end;
    }
    return this.loadHolidayDates(from, to);
  }

  /** Derived fields for a task write; nulls when effort/dates can't produce a value. */
  private dailyEffortFields(
    effort: number | null | undefined,
    start: Date | null | undefined,
    end: Date | null | undefined,
    holidayDates: Set<string>,
  ): { dailyEffort: number | null; workingDays: number | null } {
    const derived = deriveDailyEffort(effort, start, end, holidayDates);
    return { dailyEffort: derived?.dailyEffort ?? null, workingDays: derived?.workingDays ?? null };
  }

  /** Effort/date fallback chain plus one holiday load, for a single create/update. */
  private async deriveTaskDailyEffort(input: {
    estimatedEffort?: number | null;
    plannedHours?: number | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    plannedStart?: Date | string | null;
    plannedEnd?: Date | string | null;
  }): Promise<{ dailyEffort: number | null; workingDays: number | null }> {
    const effort =
      input.estimatedEffort && input.estimatedEffort > 0 ? input.estimatedEffort : input.plannedHours;
    const start = this.asDate(input.startDate ?? input.plannedStart ?? null);
    const end = this.asDate(input.endDate ?? input.plannedEnd ?? null);
    if (effort == null || effort <= 0 || !start || !end) {
      return { dailyEffort: null, workingDays: null };
    }
    const holidayDates = await this.loadHolidayDates(start, end);
    return this.dailyEffortFields(effort, start, end, holidayDates);
  }

  /** Coerce a DTO Date/ISO string into a valid Date, else null. */
  private asDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // ── Subtask rules ─────────────────────────────────────────────────────────
  // A subtask may not estimate more than its parent task, and carries no Change
  // Request, complexity or progress of its own (see subtask-rules.util.ts).
  // Everything here is "ignore, don't clear": a value already stored on a task
  // is never overwritten by these rules, so nothing that predates them is
  // touched — they only shape what new writes are allowed to do.

  /**
   * Reject a subtask whose effort would push the subtasks past the parent's own
   * estimate. `subtaskId` is the row being saved (null on create) and is left
   * out of the sibling total so an edit doesn't count itself twice. Only called
   * when an effort value is actually being written, so editing any other field
   * on a legacy subtask that already exceeds its parent still succeeds.
   */
  private async assertSubtaskEffortWithinParent(
    parentId: string,
    subtaskId: string | null,
    incomingEffortHours: number | null,
  ): Promise<void> {
    const [parent, siblings] = await Promise.all([
      this.prisma.task.findUnique({
        where: { id: parentId },
        select: { estimatedEffort: true, plannedHours: true },
      }),
      this.prisma.task.findMany({
        where: { parentId, ...(subtaskId ? { NOT: { id: subtaskId } } : {}) },
        select: { estimatedEffort: true, plannedHours: true },
      }),
    ]);
    // A parent that doesn't exist is reported by the caller's own validation.
    if (!parent) return;

    const result = checkSubtaskEffortCeiling({
      parentEffort: resolveEffortHours(parent),
      siblingTotal: sumEffortHours(siblings),
      incomingEffort: incomingEffortHours,
    });
    if (!result.over) return;

    const incoming = result.total - result.siblingTotal;
    throw new BadRequestException(
      `Subtask estimates cannot exceed the parent task estimate — parent ${formatHours(result.ceiling as number)}h, ` +
        `existing subtasks ${formatHours(result.siblingTotal)}h, this subtask ${formatHours(incoming)}h ` +
        `(total ${formatHours(result.total)}h).`,
    );
  }

  /**
   * Shared scoping for the task list — used by both the board fetch and the
   * Excel export, so an export can never surface a task the board wouldn't
   * have shown. Returns `null` when scoping resolves to "no tasks" (e.g. a
   * PM/TL with no projects) rather than an empty-result marker mixed into
   * the where clause.
   */
  private async buildTaskListWhere(
    user: { id: string; role: string },
    projectId?: string,
    milestoneId?: string,
    assigneeId?: string,
    status?: string,
    crId?: string,
    parentId?: string,
  ) {
    const where: any = {
      projectId: projectId || undefined,
      milestoneId: milestoneId || undefined,
      assigneeId: assigneeId || undefined,
      status: status || undefined,
      crId: crId || undefined,
      parentId: parentId || undefined,
    };

    if (user.role === 'ADMIN') {
      // ADMIN sees everything — no additional filtering needed.
    } else if (['PM', 'TL'].includes(user.role) && !parentId) {
      // PM / TL: when no specific project is selected, scope tasks to only
      // projects they are involved in (PM of, creator of, or allocated to).
      // When a specific projectId is provided, the existing filter applies.
      if (!projectId) {
        const userProjects = await this.prisma.project.findMany({
          where: {
            OR: [
              { pmId: user.id },
              { createdById: user.id },
              { allocations: { some: { userId: user.id } } },
            ],
          },
          select: { id: true },
        });
        const projectIds = userProjects.map((p) => p.id);
        // If the user has no projects, return an empty result set.
        if (projectIds.length === 0) {
          return null;
        }
        where.projectId = { in: projectIds };
      }
    } else if (!parentId) {
      // Regular users (USER, FREELANCER, HR): show only tasks they're
      // assigned to (primary or additional assignee), OR parent tasks that
      // have subtasks assigned to them.
      delete where.assigneeId;
      where.OR = [
        { assigneeId: user.id },
        { taskAssignees: { some: { userId: user.id } } },
        { subTasks: { some: { assigneeId: user.id } } },
        { subTasks: { some: { taskAssignees: { some: { userId: user.id } } } } },
      ];
    }

    return where;
  }

  async findAll(user: { id: string; role: string }, projectId?: string, milestoneId?: string, assigneeId?: string, status?: string, crId?: string, parentId?: string) {
    const where = await this.buildTaskListWhere(user, projectId, milestoneId, assigneeId, status, crId, parentId);
    if (!where) return [];

    return this.prisma.task.findMany({
      where,
      include: {
        subTasks: { select: { id: true, title: true, status: true, assigneeId: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        taskAssignees: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
        milestone: { select: { id: true, name: true } },
        changeRequest: { select: { id: true, crCode: true, status: true } },
        taskTypeMaster: { select: { id: true, name: true } },
        parent: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Excel export of the task board — same filters and scoping as `findAll`. */
  async exportTasks(user: { id: string; role: string }, projectId?: string, milestoneId?: string, assigneeId?: string, status?: string, crId?: string, parentId?: string) {
    const where = await this.buildTaskListWhere(user, projectId, milestoneId, assigneeId, status, crId, parentId);

    const tasks = where
      ? await this.prisma.task.findMany({
          where,
          include: {
            project: { select: { name: true, projectCode: true } },
            assignee: { select: { firstName: true, lastName: true, email: true } },
            milestone: { select: { name: true } },
            taskTypeMaster: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const displayName = (u: { firstName: string | null; lastName: string | null; email: string } | null) =>
      u ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email) : '';

    const rows = tasks.map((t) => ({
      title: t.title,
      project: t.project.projectCode ? `${t.project.name} [${t.project.projectCode}]` : t.project.name,
      status: t.status,
      priority: t.priority,
      assignee: displayName(t.assignee),
      taskType: t.taskTypeMaster?.name ?? t.taskType ?? '',
      milestone: t.milestone?.name ?? '',
      startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : '',
      endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : '',
      progressPct: t.progressPct,
      estimatedEffort: t.estimatedEffort ?? '',
      dailyEffort: t.dailyEffort ?? '',
      actualEffort: t.actualEffort,
    }));

    const columns = [
      { header: 'Title', key: 'title' },
      { header: 'Project', key: 'project' },
      { header: 'Status', key: 'status' },
      { header: 'Priority', key: 'priority' },
      { header: 'Assignee', key: 'assignee' },
      { header: 'Task Type', key: 'taskType' },
      { header: 'Milestone', key: 'milestone' },
      { header: 'Start Date', key: 'startDate' },
      { header: 'End Date', key: 'endDate' },
      { header: 'Progress %', key: 'progressPct' },
      { header: 'Estimated Effort (hrs)', key: 'estimatedEffort' },
      { header: 'Daily Effort (hrs/day)', key: 'dailyEffort' },
      { header: 'Actual Effort (hrs)', key: 'actualEffort' },
    ];

    return this.exportService.toExcel('Tasks', columns, rows);
  }

  async findAllForPmTl(user: { id: string; role: string }, projectId?: string) {
    const include = {
      subTasks: { select: { id: true, title: true, status: true, assigneeId: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      taskAssignees: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
      milestone: { select: { id: true, name: true } },
      changeRequest: { select: { id: true, crCode: true, status: true } },
      taskTypeMaster: { select: { id: true, name: true } },
    };

    // Specific project selected — return all tasks for that project.
    if (projectId) {
      return this.prisma.task.findMany({
        where: { projectId },
        include,
        orderBy: { createdAt: 'desc' },
      });
    }

    // "All Projects" — scope to connected projects + personally created/assigned tasks.
    const userProjects = await this.prisma.project.findMany({
      where: {
        OR: [
          { pmId: user.id },
          { createdById: user.id },
          { allocations: { some: { userId: user.id } } },
        ],
      },
      select: { id: true },
    });
    const projectIds = userProjects.map((p) => p.id);

    return this.prisma.task.findMany({
      where: {
        OR: [
          ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
          { createdById: user.id },
          { assigneeId: user.id },
          { taskAssignees: { some: { userId: user.id } } },
        ],
      },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        subTasks: true,
        parent: { select: { id: true, title: true } },
        project: { select: { id: true, name: true, type: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        taskAssignees: { select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        skills: { include: { skill: true } },
        milestone: true,
        predecessor: { select: { id: true, title: true } },
        changeRequest: { select: { id: true, crCode: true, status: true } },
        taskTypeMaster: { select: { id: true, name: true } },
      },
    });

    if (!task) throw new NotFoundException(`Task with ID ${id} not found`);
    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, actor?: { id: string; role: string }) {
    const oldTask = await this.findOne(id);

    const dto = updateTaskDto as any;

    if (dto.status === 'COMPLETED') {
      const pendingSubtasks = (oldTask.subTasks ?? []).filter((st: any) => st.status !== 'COMPLETED');
      if (pendingSubtasks.length > 0) {
        throw new BadRequestException(
          `Cannot complete task: ${pendingSubtasks.length} subtask${pendingSubtasks.length !== 1 ? 's are' : ' is'} still pending.`
        );
      }

      const linkedCr = (oldTask as any).changeRequest;
      if (linkedCr && linkedCr.status !== CRStatus.CLOSED) {
        throw new BadRequestException(
          `Cannot complete task: linked Change Request ${linkedCr.crCode} must be closed first (current status: ${(linkedCr.status as string).replace('_', ' ')}).`
        );
      }
    }

    const effectiveParentId = dto.parentId ?? oldTask.parentId;
    if (effectiveParentId && (dto.startDate !== undefined || dto.endDate !== undefined || dto.sprintId !== undefined)) {
      const parent = await this.prisma.task.findUnique({
        where: { id: effectiveParentId },
        select: { startDate: true, endDate: true, sprintId: true, wbsLevel: true },
      });
      if (parent) {
        const newStart = dto.startDate ? new Date(dto.startDate) : (oldTask.startDate ?? null);
        const newEnd   = dto.endDate   ? new Date(dto.endDate)   : (oldTask.endDate   ?? null);
        if (newStart && parent.startDate && newStart < parent.startDate) {
          throw new BadRequestException(`Subtask start date cannot be before parent task start date (${parent.startDate.toISOString().substring(0, 10)})`);
        }
        if (newEnd && parent.endDate && newEnd > parent.endDate) {
          throw new BadRequestException(`Subtask end date cannot exceed parent task end date (${parent.endDate.toISOString().substring(0, 10)})`);
        }
        if (dto.sprintId && parent.sprintId && dto.sprintId !== parent.sprintId) {
          throw new BadRequestException('Subtask must be in the same sprint as the parent task');
        }
      }
    }

    if (dto.predecessorId) {
      if (dto.predecessorId === id) {
        throw new BadRequestException('A task cannot be its own predecessor');
      }
      await this.checkCircularDependency(id, dto.predecessorId);
    }

    const { skillIds, assigneeIds, ...taskData } = dto as { skillIds?: string[]; assigneeIds?: string[] } & Record<string, any>;

    // dailyEffort/workingDays are server-derived; a hand-typed value only lands
    // when the client flags it with dailyEffortOverride (handled below).
    delete taskData.dailyEffort;
    delete taskData.workingDays;
    delete taskData.dailyEffortOverride;

    if (effectiveParentId) {
      // Subtasks own no Change Request, complexity or progress — ignored on
      // write and never cleared, so a subtask that already stores them keeps
      // doing so; only the parent task carries that information now.
      delete taskData.crId;
      delete taskData.phase;
      delete taskData.complexity;
      delete taskData.progressPct;
    }

    // Snapshot the assignee set BEFORE the update so only people newly added get
    // notified. Without this diff, every unrelated edit would re-mail everyone
    // already on the task.
    const previousAssigneeIds = new Set(
      [
        oldTask.assigneeId,
        ...(oldTask.taskAssignees ?? []).map((ta: any) => ta.user.id),
      ].filter(Boolean) as string[],
    );

    if (skillIds !== undefined) {
      await this.prisma.taskSkill.deleteMany({ where: { taskId: id } });
      if (skillIds.length > 0) {
        await this.prisma.taskSkill.createMany({
          data: skillIds.map((skillId: string) => ({ taskId: id, skillId })),
        });
      }
    }

    // Replace the assignee set when assigneeIds is provided; keep primary in sync.
    if (assigneeIds !== undefined) {
      const uniqueAssigneeIds = [...new Set(assigneeIds)];
      await this.validateAssigneesAllocated(oldTask.projectId, uniqueAssigneeIds, actor);
      await this.prisma.taskAssignee.deleteMany({ where: { taskId: id } });
      if (uniqueAssigneeIds.length > 0) {
        await this.prisma.taskAssignee.createMany({
          data: uniqueAssigneeIds.map((userId) => ({ taskId: id, userId })),
        });
      }
      // Sync primary unless an explicit assigneeId was also sent in this update.
      if (taskData.assigneeId === undefined) {
        taskData.assigneeId = uniqueAssigneeIds[0] ?? null;
      }
    } else if (taskData.assigneeId !== undefined && taskData.assigneeId) {
      await this.validateAssigneesAllocated(oldTask.projectId, [taskData.assigneeId], actor);
    }

    // Daily effort: a flagged hand-typed value is stored as-is (its working-day
    // window refreshes when dates change). Otherwise the auto value recomputes
    // when its inputs change or when the client explicitly turns the override
    // off — a status-only move never touches it.
    const effortInputKeys = ['estimatedEffort', 'plannedHours', 'startDate', 'endDate', 'plannedStart', 'plannedEnd'];
    const inputsChanged = effortInputKeys.some((key) => dto[key] !== undefined);
    const pick = (key: string) => (dto[key] !== undefined ? dto[key] : (oldTask as any)[key]);
    const effectiveWindow = () => ({
      estimatedEffort: pick('estimatedEffort'),
      plannedHours: pick('plannedHours'),
      startDate: pick('startDate'),
      endDate: pick('endDate'),
      plannedStart: pick('plannedStart'),
      plannedEnd: pick('plannedEnd'),
    });
    const manualDailyEffort =
      dto.dailyEffortOverride === true && typeof dto.dailyEffort === 'number'
        ? dto.dailyEffort
        : undefined;

    if (manualDailyEffort !== undefined) {
      taskData.dailyEffort = manualDailyEffort;
      taskData.dailyEffortOverride = true;
      if (inputsChanged) {
        taskData.workingDays = (await this.deriveTaskDailyEffort(effectiveWindow())).workingDays;
      }
    } else if (dto.dailyEffortOverride === false || inputsChanged) {
      const derived = await this.deriveTaskDailyEffort(effectiveWindow());
      taskData.dailyEffort = derived.dailyEffort;
      taskData.workingDays = derived.workingDays;
      taskData.dailyEffortOverride = false;
    }

    // Subtask effort ceiling — only re-checked when an effort value is being
    // written or the task is being re-parented, so unrelated edits to a subtask
    // that already exceeds its parent keep working.
    if (
      effectiveParentId &&
      (dto.estimatedEffort !== undefined || dto.plannedHours !== undefined || dto.parentId !== undefined)
    ) {
      await this.assertSubtaskEffortWithinParent(
        effectiveParentId,
        id,
        resolveEffortHours({ estimatedEffort: pick('estimatedEffort'), plannedHours: pick('plannedHours') }),
      );
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        ...taskData,
        startDate: taskData.startDate ? new Date(taskData.startDate as string) : undefined,
        endDate: taskData.endDate ? new Date(taskData.endDate as string) : undefined,
        plannedStart: taskData.plannedStart ? new Date(taskData.plannedStart as string) : undefined,
        plannedEnd: taskData.plannedEnd ? new Date(taskData.plannedEnd as string) : undefined,
      },
      include: {
        skills: { include: { skill: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        taskAssignees: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
        changeRequest: { select: { id: true, crCode: true, status: true } },
        taskTypeMaster: { select: { id: true, name: true } },
      },
    });

    // Build before/after from only the fields that were sent in the DTO
    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    for (const [key, newVal] of Object.entries(taskData)) {
      if (newVal === undefined) continue;
      const oldVal = (oldTask as any)[key];
      // Store assignee name instead of ID
      if (key === 'assigneeId') {
        before['assignee'] = this.resolveAssigneeName(oldTask, oldVal ?? null);
        after['assignee'] = this.resolveAssigneeName(updatedTask, newVal as string ?? null);
        continue;
      }
      before[key] = oldVal instanceof Date ? oldVal.toISOString().substring(0, 10) : (oldVal ?? null);
      after[key] = newVal instanceof Date ? (newVal as Date).toISOString().substring(0, 10) : (newVal ?? null);
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        module: 'TASKS',
        entityId: id,
        userId: actor?.id || null,
        before,
        after,
      },
    }).catch(() => {});

    if (actor?.id) {
      const currentAssigneeIds = [
        updatedTask.assigneeId,
        ...(updatedTask.taskAssignees ?? []).map((ta) => ta.user.id),
      ].filter(Boolean) as string[];
      const newlyAssigned = currentAssigneeIds.filter((uid) => !previousAssigneeIds.has(uid));
      await this.notifyAssignees([id], newlyAssigned, actor.id);
    }

    return updatedTask;
  }

  async updateProgress(taskId: string, progressPct: number, userId?: string) {
    if (progressPct < 0 || progressPct > 100) {
      throw new BadRequestException('progressPct must be between 0 and 100');
    }
    const oldTask = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true, parentId: true, progressPct: true } });
    if (!oldTask) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }
    // Progress is a property of the parent task — subtasks carry none (see
    // subtask-rules.util.ts) and there is no longer a roll-up to feed.
    if (oldTask.parentId) {
      throw new BadRequestException('Progress is tracked on the parent task — update the parent task instead.');
    }
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { progressPct },
      select: { id: true, parentId: true, progressPct: true },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        module: 'TASKS',
        entityId: taskId,
        userId: userId || null,
        before: { progressPct: oldTask?.progressPct ?? null },
        after: { progressPct },
      },
    }).catch(() => {});
    return task;
  }

  async getCriticalPath(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { endDate: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const where: any = {
      projectId,
      OR: [
        { isCritical: true },
        ...(project.endDate ? [{ endDate: project.endDate }] : []),
      ],
    };

    return this.prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        subTasks: { select: { id: true, title: true, progressPct: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  private async checkCircularDependency(taskId: string, predecessorId: string) {
    let currentPredecessorId = predecessorId;
    const visited = new Set<string>();

    while (currentPredecessorId) {
      if (currentPredecessorId === taskId) {
        throw new BadRequestException('Circular dependency detected in task links');
      }
      if (visited.has(currentPredecessorId)) break; // Safety break
      visited.add(currentPredecessorId);

      const predecessor = await this.prisma.task.findUnique({
        where: { id: currentPredecessorId },
        select: { predecessorId: true }
      });

      if (!predecessor || !predecessor.predecessorId) break;
      currentPredecessorId = predecessor.predecessorId;
    }
  }

  async remove(id: string, userId?: string) {
    const task = await this.findOne(id);
    await this.prisma.auditLog.create({
      data: {
        action: 'DELETE',
        module: 'TASKS',
        entityId: id,
        userId: userId || null,
        before: this.serializeTaskSnapshot(task),
      },
    }).catch(() => {});
    return this.prisma.task.delete({ where: { id } });
  }

  private serializeTaskSnapshot(task: any): Record<string, any> {
    const assigneeName = task.assignee
      ? `${task.assignee.firstName ?? ''} ${task.assignee.lastName ?? ''}`.trim() || null
      : null;
    return {
      title: task.title,
      status: task.status,
      priority: task.priority,
      taskType: task.taskType ?? null,
      assignee: assigneeName ?? task.assigneeId ?? null,
      estimatedEffort: task.estimatedEffort ?? null,
      startDate: task.startDate instanceof Date ? task.startDate.toISOString().substring(0, 10) : (task.startDate ?? null),
      endDate: task.endDate instanceof Date ? task.endDate.toISOString().substring(0, 10) : (task.endDate ?? null),
      progressPct: task.progressPct ?? 0,
      crId: task.crId ?? null,
      phase: task.phase ?? null,
    };
  }

  private resolveAssigneeName(task: any, fallbackId: string | null): string | null {
    if (task?.assignee) {
      return `${task.assignee.firstName ?? ''} ${task.assignee.lastName ?? ''}`.trim() || fallbackId;
    }
    return fallbackId;
  }

}
