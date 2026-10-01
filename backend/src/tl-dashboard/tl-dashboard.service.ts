import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, ProjectStatus, TimesheetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveTimeZone, getUtcForZonedLocalDateTime } from '../attendance/time-zone.util';
import { computeTrend, getPeriodWindows, PeriodWindow, Trend } from '../common/period-window.util';
import { TlStatsQueryDto } from './dto/tl-stats-query.dto';
import { TlLeaveCalendarQueryDto } from './dto/tl-leave-calendar-query.dto';
import { TlGanttQueryDto } from './dto/tl-gantt-query.dto';

// Task.status is a plain string column (no DB-level enum) — bucketed here per
// the confirmed 3-way mapping: not-yet-started / in-flight / done.
const BACKLOG_STATUSES = new Set(['BACKLOG', 'TODO']);
const WIP_STATUSES = new Set(['WIP', 'QA']);
const DONE_STATUS = 'COMPLETED';

export interface StatusBucket {
  backlog: number;
  wip: number;
  done: number;
  total: number;
}

@Injectable()
export class TlDashboardService {
  constructor(private prisma: PrismaService) {}

  // Direct reports only (reportingAuthorityId), excluding the TL themself —
  // deliberately not ScopeResolverService.resolveAllowedUserIds(), which
  // prepends the actor for its DataScope.TEAM case. Mirrors the local
  // reportingAuthorityId lookup leaves.service.ts already uses for its own
  // team calendar.
  private async getDirectReportIds(tlId: string): Promise<string[]> {
    const reports = await this.prisma.user.findMany({
      where: { reportingAuthorityId: tlId, isActive: true, employmentStatus: 'ACTIVE' },
      select: { id: true },
    });
    return reports.map((r) => r.id);
  }

  // ─── Stats (4 cards) ────────────────────────────────────────────────────────

  async getStats(tlId: string, query: TlStatsQueryDto) {
    const timeZone = resolveTimeZone(query.timeZone);
    const referenceDate = query.referenceDate ? new Date(query.referenceDate) : new Date();
    const period = query.period ?? 'WEEKLY';
    const windows = getPeriodWindows(period, timeZone, referenceDate);

    const [activeProjects, leaveRequestsPending, timesheetApprovalsPending, totalResources] = await Promise.all([
      this.getActiveProjectsCard(tlId, windows.current, windows.prior),
      this.getLeaveRequestsCard(tlId, windows.current, windows.prior),
      this.getTimesheetApprovalsCard(tlId, windows.current, windows.prior),
      this.getTotalResourcesCard(tlId, windows.current, windows.prior),
    ]);

    return {
      period,
      windowStart: windows.current.start.toISOString(),
      windowEnd: windows.current.end.toISOString(),
      activeProjects,
      leaveRequestsPending,
      timesheetApprovalsPending,
      totalResources,
    };
  }

  // Projects the TL manages (PM), created, is allocated to, or has a task in —
  // extends the OR pattern used elsewhere (projects.service.ts findAll,
  // tasks.service.ts findAllForPmTl) with task-involvement.
  private async getActiveProjectsCard(
    tlId: string,
    current: PeriodWindow,
    prior: PeriodWindow,
  ): Promise<{ count: number; trend: Trend }> {
    const taskInvolvement: Prisma.ProjectWhereInput = {
      tasks: {
        some: {
          OR: [
            { assigneeId: tlId },
            { taskAssignees: { some: { userId: tlId } } },
            {
              subTasks: {
                some: {
                  OR: [{ assigneeId: tlId }, { taskAssignees: { some: { userId: tlId } } }],
                },
              },
            },
          ],
        },
      },
    };

    const liveWhere: Prisma.ProjectWhereInput = {
      status: ProjectStatus.ACTIVE,
      OR: [{ pmId: tlId }, { createdById: tlId }, { allocations: { some: { userId: tlId } } }, taskInvolvement],
    };

    const countForWindow = async (win: PeriodWindow) => {
      const rows = await this.prisma.project.findMany({
        where: {
          status: ProjectStatus.ACTIVE,
          OR: [
            { createdAt: { gte: win.start, lt: win.end }, OR: [{ pmId: tlId }, { createdById: tlId }] },
            { allocations: { some: { userId: tlId, createdAt: { gte: win.start, lt: win.end } } } },
            {
              tasks: {
                some: {
                  createdAt: { gte: win.start, lt: win.end },
                  OR: [{ assigneeId: tlId }, { taskAssignees: { some: { userId: tlId } } }],
                },
              },
            },
          ],
        },
        select: { id: true },
        distinct: ['id'],
      });
      return rows.length;
    };

    const [count, currentPeriodCount, priorPeriodCount] = await Promise.all([
      this.prisma.project.count({ where: liveWhere }),
      countForWindow(current),
      countForWindow(prior),
    ]);

    return { count, trend: computeTrend(currentPeriodCount, priorPeriodCount) };
  }

  // Pending leave requests awaiting this TL's approval — mirrors
  // canApproveReportingAuthority's predicate (single-step RA approval today;
  // pmStatus/hrStatus exist but are dormant).
  private async getLeaveRequestsCard(
    tlId: string,
    current: PeriodWindow,
    prior: PeriodWindow,
  ): Promise<{ count: number; trend: Trend }> {
    const [count, currentPeriodCount, priorPeriodCount] = await Promise.all([
      this.prisma.leave.count({
        where: { status: 'PENDING', raStatus: 'PENDING', user: { reportingAuthorityId: tlId } },
      }),
      // Trend = new submissions in the window, independent of current status —
      // reflects incoming volume rather than shrinking as items get actioned.
      this.prisma.leave.count({
        where: { user: { reportingAuthorityId: tlId }, createdAt: { gte: current.start, lt: current.end } },
      }),
      this.prisma.leave.count({
        where: { user: { reportingAuthorityId: tlId }, createdAt: { gte: prior.start, lt: prior.end } },
      }),
    ]);

    return { count, trend: computeTrend(currentPeriodCount, priorPeriodCount) };
  }

  // SUBMITTED timesheets for the TL's team only (not the TL's own).
  private async getTimesheetApprovalsCard(
    tlId: string,
    current: PeriodWindow,
    prior: PeriodWindow,
  ): Promise<{ count: number; trend: Trend }> {
    const baseWhere: Prisma.TimesheetWhereInput = {
      status: TimesheetStatus.SUBMITTED,
      user: { reportingAuthorityId: tlId },
    };

    const [count, currentPeriodCount, priorPeriodCount] = await Promise.all([
      this.prisma.timesheet.count({ where: baseWhere }),
      // lastStatusChange is set on every status transition including submit —
      // createdAt would be wrong (reflects the DRAFT row's original creation).
      this.prisma.timesheet.count({
        where: { ...baseWhere, lastStatusChange: { gte: current.start, lt: current.end } },
      }),
      this.prisma.timesheet.count({
        where: { ...baseWhere, lastStatusChange: { gte: prior.start, lt: prior.end } },
      }),
    ]);

    return { count, trend: computeTrend(currentPeriodCount, priorPeriodCount) };
  }

  // Active users reporting directly to this TL.
  private async getTotalResourcesCard(
    tlId: string,
    current: PeriodWindow,
    prior: PeriodWindow,
  ): Promise<{ count: number; trend: Trend }> {
    const baseWhere: Prisma.UserWhereInput = {
      reportingAuthorityId: tlId,
      isActive: true,
      employmentStatus: 'ACTIVE',
    };

    const [count, currentPeriodCount, priorPeriodCount] = await Promise.all([
      this.prisma.user.count({ where: baseWhere }),
      // Proxy for "new team member": a new hire already reporting to this TL
      // within the window. Misses an internal transfer of an existing
      // employee onto the team — no reportingAuthorityId-change timestamp
      // exists in the schema to detect that precisely.
      this.prisma.user.count({
        where: { ...baseWhere, dateOfJoining: { gte: current.start, lt: current.end } },
      }),
      this.prisma.user.count({
        where: { ...baseWhere, dateOfJoining: { gte: prior.start, lt: prior.end } },
      }),
    ]);

    return { count, trend: computeTrend(currentPeriodCount, priorPeriodCount) };
  }

  // ─── Tasks by status (2 donuts) ─────────────────────────────────────────────

  async getTasksByStatus(tlId: string) {
    const directReportIds = await this.getDirectReportIds(tlId);

    const teamWhere: Prisma.TaskWhereInput = {
      OR: [
        { assigneeId: { in: directReportIds } },
        { taskAssignees: { some: { userId: { in: directReportIds } } } },
        {
          subTasks: {
            some: {
              OR: [
                { assigneeId: { in: directReportIds } },
                { taskAssignees: { some: { userId: { in: directReportIds } } } },
              ],
            },
          },
        },
      ],
    };

    const mineWhere: Prisma.TaskWhereInput = {
      OR: [
        { assigneeId: tlId },
        { taskAssignees: { some: { userId: tlId } } },
        {
          subTasks: {
            some: {
              OR: [{ assigneeId: tlId }, { taskAssignees: { some: { userId: tlId } } }],
            },
          },
        },
      ],
    };

    const [teamGrouped, mineGrouped] = await Promise.all([
      directReportIds.length
        ? this.prisma.task.groupBy({ by: ['status'], _count: { id: true }, where: teamWhere })
        : Promise.resolve([] as { status: string; _count: { id: number } }[]),
      this.prisma.task.groupBy({ by: ['status'], _count: { id: true }, where: mineWhere }),
    ]);

    return { team: this.bucketTaskStatuses(teamGrouped), mine: this.bucketTaskStatuses(mineGrouped) };
  }

  private bucketTaskStatuses(grouped: { status: string; _count: { id: number } }[]): StatusBucket {
    let backlog = 0;
    let wip = 0;
    let done = 0;
    for (const row of grouped) {
      if (BACKLOG_STATUSES.has(row.status)) backlog += row._count.id;
      else if (WIP_STATUSES.has(row.status)) wip += row._count.id;
      else if (row.status === DONE_STATUS) done += row._count.id;
      // Any status outside the known 5 values silently falls through — not
      // expected today since Task.status has no DB-level enum constraint.
    }
    return { backlog, wip, done, total: backlog + wip + done };
  }

  // ─── Team leave calendar ────────────────────────────────────────────────────

  async getLeaveCalendar(tlId: string, query: TlLeaveCalendarQueryDto) {
    const timeZone = resolveTimeZone(query.timeZone);
    const { month, year } = query;

    const monthStart = getUtcForZonedLocalDateTime(timeZone, year, month, 1);
    const monthEnd = getUtcForZonedLocalDateTime(timeZone, year, month + 1, 1);
    const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return { date: dateStr, employees: [] as { userId: string; name: string; leaveType: string; status: string; isHalfDay: boolean }[] };
    });

    const directReportIds = await this.getDirectReportIds(tlId);
    if (directReportIds.length === 0) return { month, year, days };

    const leaves = await this.prisma.leave.findMany({
      where: {
        userId: { in: directReportIds },
        status: { not: 'REJECTED' },
        startDate: { lt: monthEnd },
        endDate: { gte: monthStart },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
        leaveTypeCode: true,
        status: true,
        isHalfDay: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    for (const leave of leaves) {
      const name = `${leave.user?.firstName ?? ''} ${leave.user?.lastName ?? ''}`.trim() || 'Unknown';
      // Clip the leave span to this month's day array.
      const spanStart = leave.startDate < monthStart ? monthStart : leave.startDate;
      const spanEndExclusive = leave.endDate >= monthEnd ? monthEnd : getUtcForZonedLocalDateTime(
        timeZone,
        ...this.addOneDay(timeZone, leave.endDate),
      );
      let cursor = spanStart;
      while (cursor < spanEndExclusive && cursor < monthEnd) {
        const dayIndex = Math.floor((cursor.getTime() - monthStart.getTime()) / 86_400_000);
        if (dayIndex >= 0 && dayIndex < days.length) {
          days[dayIndex].employees.push({
            userId: leave.userId,
            name,
            leaveType: leave.leaveTypeCode ?? 'LEAVE',
            status: leave.status,
            isHalfDay: leave.isHalfDay,
          });
        }
        cursor = new Date(cursor.getTime() + 86_400_000);
      }
    }

    return { month, year, days };
  }

  private addOneDay(timeZone: string, date: Date): [number, number, number] {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return [get('year'), get('month'), get('day') + 1];
  }

  // ─── Gantt ──────────────────────────────────────────────────────────────────

  async getGantt(tlId: string, query: TlGanttQueryDto) {
    const scope = query.scope ?? 'ME';
    let targetUserIds: string[];

    if (scope === 'TEAM') {
      targetUserIds = await this.getDirectReportIds(tlId);
      if (targetUserIds.length === 0) {
        return { data: [], meta: { total: 0, page: query.page ?? 1, limit: query.limit ?? 20, totalPages: 0 } };
      }
    } else if (scope === 'MEMBER') {
      if (!query.memberId) throw new BadRequestException('memberId is required when scope=MEMBER');
      const directReportIds = await this.getDirectReportIds(tlId);
      if (!directReportIds.includes(query.memberId)) {
        throw new ForbiddenException("You are not allowed to view this user's tasks");
      }
      targetUserIds = [query.memberId];
    } else {
      targetUserIds = [tlId];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Direct assignment only — deliberately NOT tasks.service.ts's
    // buildTaskListWhere, which also pulls in a parent task whenever any
    // subtask matches. That's a sensible task-board convenience but wrong
    // here: a parent row pulled in only via a child assignment would show
    // its own (likely irrelevant) estimate/logged figures.
    //
    // The assignment check is an OR; the optional date-range filter is a
    // separate AND — kept in distinct clauses so they don't collide.
    const dateRangeClauses: Prisma.TaskWhereInput[] = [];
    if (query.from) {
      dateRangeClauses.push({ OR: [{ endDate: { gte: new Date(query.from) } }, { endDate: null }] });
    }
    if (query.to) {
      dateRangeClauses.push({ OR: [{ startDate: { lte: new Date(query.to) } }, { startDate: null }] });
    }

    const where: Prisma.TaskWhereInput = {
      OR: [{ assigneeId: { in: targetUserIds } }, { taskAssignees: { some: { userId: { in: targetUserIds } } } }],
      projectId: query.projectId || undefined,
      status: query.status || undefined,
      AND: dateRangeClauses.length ? dateRangeClauses : undefined,
    };

    const allRows = await this.prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        startDate: true,
        endDate: true,
        plannedStart: true,
        plannedEnd: true,
        plannedHours: true,
        estimatedEffort: true,
        actualEffort: true,
        progressPct: true,
        parentId: true,
        parent: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let mapped = allRows.map((t) => {
      const estimateHours = t.plannedHours ?? t.estimatedEffort ?? null;
      const loggedHours = t.actualEffort ?? 0;
      const withinEstimate: 'WITHIN' | 'OVER' | 'UNESTIMATED' =
        estimateHours == null ? 'UNESTIMATED' : loggedHours <= estimateHours ? 'WITHIN' : 'OVER';
      const variance = estimateHours != null ? Math.round((loggedHours - estimateHours) * 100) / 100 : null;
      const variancePct =
        estimateHours != null && estimateHours > 0 ? Math.round((variance! / estimateHours) * 1000) / 10 : null;
      return { ...t, estimateHours, loggedHours, withinEstimate, variance, variancePct };
    });

    if (query.withinEstimate) {
      mapped = mapped.filter((t) => t.withinEstimate === query.withinEstimate);
    }

    const sortBy = query.sortBy ?? 'endDate';
    const sortDir = query.sortDir ?? 'asc';
    const dir = sortDir === 'asc' ? 1 : -1;
    mapped.sort((a, b) => {
      const av = this.sortValue(a, sortBy);
      const bv = this.sortValue(b, sortBy);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last regardless of direction
      if (bv == null) return -1;
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });

    const total = mapped.length;
    const start = (page - 1) * limit;
    const data = mapped.slice(start, start + limit);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  private sortValue(
    row: { endDate: Date | null; estimateHours: number | null; loggedHours: number; variance: number | null },
    sortBy: 'endDate' | 'estimate' | 'logged' | 'variance',
  ): number | null {
    switch (sortBy) {
      case 'endDate':
        return row.endDate ? row.endDate.getTime() : null;
      case 'estimate':
        return row.estimateHours;
      case 'logged':
        return row.loggedHours;
      case 'variance':
        return row.variance;
    }
  }
}
