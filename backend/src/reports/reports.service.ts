import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { TimesheetReportQueryDto } from './dto/timesheet-report-query.dto';
import { TimesheetEntriesQueryDto } from './dto/timesheet-entries-query.dto';
import { MonthlyEffortsQueryDto } from './dto/monthly-efforts-query.dto';
import { MonthlyAttendanceQueryDto } from './dto/monthly-attendance-query.dto';
import { NonComplianceQueryDto } from './dto/non-compliance-query.dto';
import dayjs from 'dayjs';

import { AllocationsService } from '../allocations/allocations.service';
import {
  getUtcForZonedLocalDateTime,
  getZonedDateParts,
  resolveTimeZone,
} from '../attendance/time-zone.util';
import { DateParts, resolveNonComplianceRange, toDateKey } from './non-compliance.util';

// Every timesheet entry ever logged, across every employee, accumulates forever —
// unlike most other reports here, which are bounded by headcount. An unfiltered
// (or very wide) date range on these two reports loads the entire table into
// memory in one `findMany`, which is what crashed the Excel export. Requiring a
// date range and capping its span keeps both bounded regardless of company age.
const MAX_TIMESHEET_REPORT_RANGE_DAYS = 366;

// The dynamic timesheet-entries report (`getTimesheetReportDetailed*`) allows a
// fully unfiltered query on the GET side — pagination bounds each response
// regardless of filters. The Excel export has no such bound (it must build the
// whole filtered set into one workbook in memory), so it keeps an explicit cap
// instead, guarding against the same failure mode noted above.
const MAX_TIMESHEET_EXPORT_ROWS = 50_000;

// The compliance report is bounded by headcount x days-in-range, but its Excel
// export still builds the whole set into one workbook in memory. The range is
// already capped in resolveNonComplianceRange, so this is a second, cheap
// guard against a large headcount x wide range still adding up.
const MAX_NON_COMPLIANCE_EXPORT_ROWS = 20_000;

// Shared `include` for the detailed timesheet-entries report, used by both the
// paginated GET and the Excel export so their row shape can never drift apart.
const DETAILED_ENTRY_INCLUDE = {
  timesheet: {
    select: {
      status: true,
      endDate: true,
      lastStatusChange: true,
      userId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: { select: { name: true } },
        },
      },
      freelancer: { select: { fullName: true, email: true } },
    },
  },
  project: { select: { name: true } },
  task: { select: { title: true, plannedHours: true, estimatedEffort: true } },
  ticket: { select: { title: true } },
  activityMaster: { select: { activity: true } },
  taskSubActivity: {
    select: { name: true, activity: { select: { name: true } } },
  },
} satisfies Prisma.TimesheetEntryInclude;

type DetailedEntry = Prisma.TimesheetEntryGetPayload<{ include: typeof DETAILED_ENTRY_INCLUDE }>;

interface MonthlyEffortRawRow {
  name: string | null;
  total_hours: number;
  total_minutes: number;
}

interface MonthlyAttendanceRawRow {
  employee_name: string | null;
  username: string;
  user_status: string;
  date: Date;
  day_of_week: string;
  check_in_time: Date | null;
}

// `date` is deliberately a string: it is produced by `to_char(..., 'YYYY-MM-DD')`
// on the database side so the node-postgres `date`/`timestamptz` parsers — which
// hydrate to a JS Date at *local* midnight and would shift the day for any viewer
// west of UTC — never get a chance to touch it.
interface NonComplianceRawRow {
  employee_name: string | null;
  employee_code: string | null;
  email: string;
  department: string | null;
  manager_name: string | null;
  shift_start_time: string | null;
  date: string;
  day_of_week: string;
}

// Everything the compliance CTEs and their SELECT need, resolved once per
// request so the paginated query and the export can never disagree about the
// range, the filters, or the timezone.
interface NonComplianceQueryContext {
  start: string;
  end: string;
  timeZone: string;
  /** Inclusive lower bound for `timestamptz` columns (see buildNonComplianceCtes). */
  rangeStartInstant: Date;
  /** Exclusive upper bound for `timestamptz` columns. */
  rangeEndInstant: Date;
  includeWeekends: boolean;
  includeHolidays: boolean;
  leaveStatuses: string[];
  userFilter: Prisma.Sql;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private allocationsService: AllocationsService,
  ) {}

  // ─── Existing Reports ───────────────────────────────────────────────────────

  // Shared by the timesheet report/export methods — see MAX_TIMESHEET_REPORT_RANGE_DAYS.
  private assertBoundedTimesheetRange(filters: ReportFiltersDto, reportLabel: string): void {
    if (!filters.startDate || !filters.endDate) {
      throw new BadRequestException(
        `${reportLabel} requires both a start and end date — please select a date range.`,
      );
    }
    const spanDays =
      (new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / 86_400_000;
    if (spanDays > MAX_TIMESHEET_REPORT_RANGE_DAYS) {
      throw new BadRequestException(
        `${reportLabel} date range is too large (max ${MAX_TIMESHEET_REPORT_RANGE_DAYS} days) — please narrow your filters.`,
      );
    }
  }

  // Bucket key for matching a timesheet entry's date to a monthly maturity record.
  private maturityMonthKey(userId: string, date: Date): string {
    return `${userId}::${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  // One batched lookup of monthly maturity values for a set of users, keyed by user + month.
  private async buildMaturityMap(userIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (userIds.length === 0) return map;
    const rows = await this.prisma.employeeMaturityHistory.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, forTheMonth: true, maturityValue: true },
    });
    for (const r of rows) {
      map.set(this.maturityMonthKey(r.userId, r.forTheMonth), r.maturityValue);
    }
    return map;
  }

  async getTimesheetReport(filters: ReportFiltersDto) {
    this.assertBoundedTimesheetRange(filters, 'Timesheet report');
    const entries = await this.prisma.timesheetEntry.findMany({
      where: {
        projectId: filters.projectId || undefined,
        date: {
          gte: filters.startDate ? new Date(filters.startDate) : undefined,
          lte: filters.endDate ? new Date(filters.endDate) : undefined,
        },
        timesheet: {
          userId: filters.userId || undefined,
        }
      },
      include: {
        timesheet: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
                role: { select: { name: true } },
              },
            },
          }
        },
        project: { select: { name: true } },
        task: { select: { title: true } },
        ticket: { select: { title: true } },
      },
      orderBy: { date: 'desc' },
    });

    const userIds = [
      ...new Set(entries.map((e) => e.timesheet?.userId).filter((id): id is string => !!id)),
    ];
    const maturityMap = await this.buildMaturityMap(userIds);

    return entries.map((e) => ({
      ...e,
      roleName: e.timesheet?.user?.role?.name ?? null,
      maturityValue: e.timesheet?.userId
        ? maturityMap.get(this.maturityMonthKey(e.timesheet.userId, e.date)) ?? null
        : null,
    }));
  }

  // Paginated counterpart to getTimesheetReport(), used by the Timesheet Report
  // table. Kept as a separate method rather than overloading getTimesheetReport()
  // itself, since that one still returns the full unpaginated array for the CSV
  // export path — two different response shapes for two different consumers.
  async getTimesheetReportPaginated(filters: TimesheetReportQueryDto) {
    this.assertBoundedTimesheetRange(filters, 'Timesheet report');
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;

    const where: Prisma.TimesheetEntryWhereInput = {
      projectId: filters.projectId || undefined,
      date: {
        gte: filters.startDate ? new Date(filters.startDate) : undefined,
        lte: filters.endDate ? new Date(filters.endDate) : undefined,
      },
      timesheet: {
        userId: filters.userId || undefined,
      },
    };

    const [entries, total, aggregate] = await this.prisma.$transaction([
      this.prisma.timesheetEntry.findMany({
        where,
        include: {
          timesheet: {
            include: {
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: { select: { name: true } },
                },
              },
            },
          },
          project: { select: { name: true } },
          task: { select: { title: true } },
          ticket: { select: { title: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timesheetEntry.count({ where }),
      // Sums the full filtered set, not just this page — the summary cards on the
      // report need the true total, and this is a cheap aggregate vs. fetching
      // every row to sum client-side.
      this.prisma.timesheetEntry.aggregate({ where, _sum: { hours: true } }),
    ]);

    const userIds = [
      ...new Set(entries.map((e) => e.timesheet?.userId).filter((id): id is string => !!id)),
    ];
    const maturityMap = await this.buildMaturityMap(userIds);

    const data = entries.map((e) => ({
      ...e,
      roleName: e.timesheet?.user?.role?.name ?? null,
      maturityValue: e.timesheet?.userId
        ? maturityMap.get(this.maturityMonthKey(e.timesheet.userId, e.date)) ?? null
        : null,
    }));

    return {
      data,
      meta: {
        total,
        totalHours: aggregate._sum.hours ?? 0,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getUtilizationReport(filters: ReportFiltersDto) {
    const startDate = filters.startDate ? dayjs(filters.startDate) : dayjs().startOf('month');
    const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs().endOf('month');

    // 1. Calculate Target Hours based on working days in the period (8h/day, excluding weekends)
    let workingDays = 0;
    let current = startDate;
    while (current.isBefore(endDate) || current.isSame(endDate)) {
      if (current.day() !== 0 && current.day() !== 6) workingDays++;
      current = current.add(1, 'day');
    }
    const targetHours = workingDays * 8;

    // 2. Fetch all active Resources (Users + Freelancers)
    const [users, freelancers] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, department: { select: { name: true } } },
      }),
      this.prisma.freelancer.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, email: true },
      }),
    ]);

    // 3. Fetch all relevant Timesheet Entries
    const entries = await this.prisma.timesheetEntry.findMany({
      where: {
        projectId: filters.projectId || undefined,
        date: {
          gte: startDate.toDate(),
          lte: endDate.toDate(),
        },
        timesheet: {
          status: (filters.status as any) || undefined,
        },
      },
      include: {
        timesheet: {
          select: { userId: true, freelancerId: true },
        },
      },
    });

    // 4. Aggregate Hours
    const stats: Record<string, number> = {};
    for (const e of entries) {
      const rId = e.timesheet.userId || e.timesheet.freelancerId;
      if (!rId) continue;
      stats[rId] = (stats[rId] || 0) + e.hours;
    }

    // 5. Combine and Format
    const report = [
      ...users.map((u) => {
        const logged = stats[u.id] || 0;
        return {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          department: u.department?.name || 'N/A',
          type: 'EMPLOYEE',
          loggedHours: logged,
          targetHours,
          utilization: targetHours > 0 ? Math.round((logged / targetHours) * 100) : 0,
        };
      }),
      ...freelancers.map((f) => {
        const logged = stats[f.id] || 0;
        const names = f.fullName.split(' ');
        return {
          id: f.id,
          firstName: names[0],
          lastName: names.slice(1).join(' ') || '',
          email: f.email,
          department: 'External',
          type: 'FREELANCER',
          loggedHours: logged,
          targetHours,
          utilization: targetHours > 0 ? Math.round((logged / targetHours) * 100) : 0,
        };
      }),
    ];

    // Filter by specific user if requested
    if (filters.userId) {
      return report.filter((r) => r.id === filters.userId);
    }

    return report.sort((a, b) => b.utilization - a.utilization);
  }

  async getProjectSummaryReport(filters: ReportFiltersDto) {
    const projects = await this.prisma.project.findMany({
      where: { id: filters.projectId || undefined },
      include: {
        tasks: true,
        tickets: true,
        clientPOs: { include: { invoices: true } },
      }
    });

    return projects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      type: p.type,
      taskCount: p.tasks.length,
      ticketCount: p.tickets.length,
      totalRevenue: p.clientPOs.reduce((sum, po) =>
        sum + po.invoices.reduce((invSum, inv) => invSum + inv.subTotal, 0), 0
      ),
    }));
  }

  async exportToCsv(data: any[], headers: string[]) {
    if (data.length === 0) return '';

    const csvRows: string[] = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] ?? '';
        const escaped = ('' + val).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  // ─── Meta Endpoints ─────────────────────────────────────────────────────────

  async getDepartments() {
    return this.prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getProjectsList() {
    return this.prisma.project.findMany({
      select: { id: true, name: true, projectCode: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  async getFinancialYears() {
    return this.prisma.financialYear.findMany({
      select: { id: true, label: true, isCurrent: true },
      orderBy: { startYear: 'desc' },
    });
  }

  async getVendorsList() {
    return this.prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, vendorName: true, vendorCode: true },
      orderBy: { vendorName: 'asc' },
    });
  }

  async getFreelancersList() {
    return this.prisma.freelancer.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, freelancerCode: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async getEmployeesList(departmentId?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        departmentId: true,
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
      email: u.email,
      departmentId: u.departmentId,
      departmentName: u.department?.name ?? null,
    }));
  }

  // ─── Operational Reports ────────────────────────────────────────────────────

  async getMissingTimesheets(weekStart: Date, departmentId?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        employmentStatus: 'ACTIVE',
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        department: { select: { name: true } },
        reportingAuthority: { select: { firstName: true, lastName: true } },
      },
    });

    const submittedTimesheets = await this.prisma.timesheet.findMany({
      where: {
        startDate: weekStart,
        status: { in: ['SUBMITTED', 'RA_APPROVED', 'PM_APPROVED'] as any },
        userId: { not: null },
      },
      select: { userId: true },
    });

    const submittedUserIds = new Set(submittedTimesheets.map(t => t.userId).filter(Boolean));

    const rows = users
      .filter(u => !submittedUserIds.has(u.id))
      .map(u => ({
        employeeCode: u.employeeCode ?? '',
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        email: u.email,
        department: u.department?.name ?? '',
        manager: u.reportingAuthority
          ? `${u.reportingAuthority.firstName ?? ''} ${u.reportingAuthority.lastName ?? ''}`.trim()
          : '',
      }));

    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      const dept = row.department || 'Unknown';
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(row);
    }

    return { rows, grouped, totalMissing: rows.length };
  }

  async getPendingApprovals(olderThanDays?: number) {
    const cutoff = olderThanDays
      ? new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
      : undefined;

    const instances = await this.prisma.workflowInstance.findMany({
      where: {
        status: 'PENDING' as any,
        ...(cutoff ? { createdAt: { lt: cutoff } } : {}),
      },
      include: {
        template: {
          include: { steps: true },
        },
        requester: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();
    const rows = instances.map(inst => {
      const step = inst.template.steps.find(s => s.stepOrder === inst.currentStep);
      const approverInfo = step
        ? (step.approverType === 'USER' ? `User:${step.approverUserId ?? ''}` : `Role:${step.approverRoleId ?? ''}`)
        : 'Reporting Authority';

      return {
        module: inst.entityType,
        entityRef: inst.entityId,
        requestedBy: `${inst.requester.firstName ?? ''} ${inst.requester.lastName ?? ''}`.trim(),
        requestedAt: inst.createdAt,
        ageDays: Math.floor((now - inst.createdAt.getTime()) / 86400000),
        currentStep: inst.currentStep,
        currentApprover: approverInfo,
      };
    });

    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!grouped[row.module]) grouped[row.module] = [];
      grouped[row.module].push(row);
    }

    return { rows, grouped };
  }

  async getOverAllocationReport(date?: Date) {
    const checkDate = date ?? new Date();

    const allocations = await this.prisma.allocation.findMany({
      where: {
        userId: { not: null },
        startDate: { lte: checkDate },
        endDate: { gte: checkDate },
      },
      include: {
        user: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: { select: { name: true, projectCode: true } },
      },
    });

    const userMap: Record<string, {
      user: any;
      allocations: { project: string; projectCode: string | null }[];
    }> = {};

    for (const alloc of allocations) {
      if (!alloc.userId || !alloc.user) continue;
      const uid = alloc.userId;
      if (!userMap[uid]) {
        userMap[uid] = { user: alloc.user, allocations: [] };
      }
      userMap[uid].allocations.push({
        project: alloc.project.name,
        projectCode: alloc.project.projectCode,
      });
    }

    // No percentage anymore, so "over-allocated" means booked on more than one
    // allocation for the same date — a conflict that shouldn't occur going
    // forward (new allocations reject overlaps), but is worth surfacing for
    // data created before that rule, or in edge cases like bulk imports.
    return Object.values(userMap)
      .filter(u => u.allocations.length > 1)
      .map(u => ({
        employeeCode: u.user.employeeCode ?? '',
        name: `${u.user.firstName ?? ''} ${u.user.lastName ?? ''}`.trim(),
        email: u.user.email,
        allocationCount: u.allocations.length,
        allocations: u.allocations,
        allocationSummary: u.allocations.map(a => a.project).join(', '),
      }))
      .sort((a, b) => b.allocationCount - a.allocationCount);
  }

  async getLeaveCalendar(month: number, year: number, departmentId?: string) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const leaves = await this.prisma.leave.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
        ...(departmentId ? { user: { departmentId } } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const days: { date: string; employees: { name: string; leaveType: string }[] }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const employees = leaves
        .filter(l => {
          const ls = new Date(l.startDate); ls.setHours(0, 0, 0, 0);
          const le = new Date(l.endDate);   le.setHours(0, 0, 0, 0);
          return ls <= date && le >= date;
        })
        .map(l => ({
          name: `${l.user.firstName ?? ''} ${l.user.lastName ?? ''}`.trim(),
          leaveType: l.leaveTypeCode ?? 'LEAVE',
        }));

      days.push({ date: dateStr, employees });
    }

    return { month, year, days };
  }

  async getPlannedVsActual(projectId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        plannedHours: true,
        actualEffort: true,
        plannedEnd: true,
        endDate: true,
        status: true,
      },
    });

    const now = new Date();
    const rows = tasks.map(t => {
      const plannedHours = t.plannedHours ?? 0;
      const actualHours = t.actualEffort ?? 0;
      const variance = actualHours - plannedHours;
      const variancePct = plannedHours > 0
        ? Math.round((variance / plannedHours) * 1000) / 10
        : 0;

      const plannedEnd = t.plannedEnd;
      const actualEnd = t.endDate;
      let delayDays = 0;
      if (plannedEnd) {
        const compareDate = actualEnd ?? (t.status !== 'COMPLETED' ? now : null);
        if (compareDate) {
          delayDays = Math.max(
            0,
            Math.floor((compareDate.getTime() - plannedEnd.getTime()) / 86400000),
          );
        }
      }

      return {
        taskTitle: t.title,
        plannedHours: Math.round(plannedHours * 100) / 100,
        actualHours: Math.round(actualHours * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        variancePct,
        plannedEnd: plannedEnd?.toISOString().split('T')[0] ?? null,
        actualEnd: actualEnd?.toISOString().split('T')[0] ?? null,
        delayDays,
      };
    });

    const totalPlannedHours = Math.round(rows.reduce((s, r) => s + r.plannedHours, 0) * 100) / 100;
    const totalActualHours = Math.round(rows.reduce((s, r) => s + r.actualHours, 0) * 100) / 100;
    const overallVariancePct = totalPlannedHours > 0
      ? Math.round(((totalActualHours - totalPlannedHours) / totalPlannedHours) * 1000) / 10
      : 0;

    return { tasks: rows, summary: { totalPlannedHours, totalActualHours, overallVariancePct } };
  }

  async getMilestoneDelays() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const milestones = await this.prisma.milestone.findMany({
      where: {
        dueDate: { lt: today },
        status: { not: 'ACHIEVED' },
      },
      include: {
        project: {
          select: {
            name: true,
            projectCode: true,
            pm: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    const rows = milestones.map(m => {
      const delayDays = m.dueDate
        ? Math.floor((today.getTime() - m.dueDate.getTime()) / 86400000)
        : 0;
      return {
        project: m.project.name,
        projectCode: m.project.projectCode ?? '',
        milestone: m.name,
        status: m.status,
        dueDate: m.dueDate?.toISOString().split('T')[0] ?? null,
        delayDays,
        amount: m.amount,
        pm: m.project.pm
          ? `${m.project.pm.firstName ?? ''} ${m.project.pm.lastName ?? ''}`.trim()
          : '',
        pmEmail: m.project.pm?.email ?? '',
      };
    });

    rows.sort((a, b) => b.delayDays - a.delayDays);

    const totalAtRisk = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    return { rows, summary: { totalAtRisk, count: rows.length } };
  }

  async getMarginByProject(financialYearId?: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        status: { in: ['ACTIVE', 'CLOSED'] as any },
      },
      include: {
        client: { select: { name: true } },
        timesheetEntries: {
          include: {
            timesheet: {
              include: {
                user: { select: { baseCostPerHour: true } },
                freelancer: { select: { costPerHour: true } },
              },
            },
          },
        },
        expenses: { select: { amount: true } },
      },
    });

    const rows = projects.map(p => {
      const revenue = p.revenue ?? 0;
      let employeeCost = 0;
      let freelancerCost = 0;

      for (const entry of p.timesheetEntries) {
        if (entry.timesheet.user) {
          employeeCost += entry.hours * (entry.timesheet.user.baseCostPerHour ?? 0);
        } else if (entry.timesheet.freelancer) {
          freelancerCost += entry.hours * (entry.timesheet.freelancer.costPerHour ?? 0);
        }
      }

      const overheadCost = p.expenses.reduce((s, e) => s + e.amount, 0);
      const totalCost = employeeCost + freelancerCost + overheadCost;
      const margin = revenue - totalCost;
      const marginPct = revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0;

      return {
        projectCode: p.projectCode ?? '',
        name: p.name,
        client: p.client?.name ?? '',
        status: p.status,
        revenue: Math.round(revenue * 100) / 100,
        employeeCost: Math.round(employeeCost * 100) / 100,
        freelancerCost: Math.round(freelancerCost * 100) / 100,
        overheadCost: Math.round(overheadCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        marginPct,
      };
    });

    rows.sort((a, b) => a.marginPct - b.marginPct);
    return rows;
  }

  async getFreelancerSpend(
    startDate: Date,
    endDate: Date,
    vendorId?: string,
    freelancerId?: string,
  ) {
    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        freelancerId: freelancerId ? freelancerId : { not: null },
        status: { in: ['SUBMITTED', 'RA_APPROVED', 'PM_APPROVED'] as any },
        startDate: { gte: startDate },
        endDate: { lte: endDate },
        ...(vendorId
          ? { freelancer: { vendorId } }
          : {}),
      },
      include: {
        freelancer: {
          include: {
            vendor: { select: { vendorName: true } },
            currency: { select: { code: true } },
          },
        },
        project: { select: { name: true, projectCode: true } },
        entries: { select: { hours: true } },
      },
    });

    const freelancerMap: Record<string, {
      freelancerCode: string;
      name: string;
      vendor: string;
      costPerHour: number;
      currency: string;
      projects: { project: string; hours: number }[];
      totalHours: number;
      totalCost: number;
    }> = {};

    for (const ts of timesheets) {
      if (!ts.freelancer || !ts.freelancerId) continue;
      const fid = ts.freelancerId;
      const hours = ts.entries.reduce((s, e) => s + e.hours, 0);

      if (!freelancerMap[fid]) {
        freelancerMap[fid] = {
          freelancerCode: ts.freelancer.freelancerCode,
          name: ts.freelancer.fullName,
          vendor: ts.freelancer.vendor?.vendorName ?? '',
          costPerHour: ts.freelancer.costPerHour,
          currency: ts.freelancer.currency?.code ?? 'INR',
          projects: [],
          totalHours: 0,
          totalCost: 0,
        };
      }

      freelancerMap[fid].totalHours += hours;
      freelancerMap[fid].totalCost += hours * ts.freelancer.costPerHour;
      freelancerMap[fid].projects.push({ project: ts.project?.name ?? 'Unknown Project', hours });
    }

    const freelancers = Object.values(freelancerMap).map(f => ({
      ...f,
      totalHours: Math.round(f.totalHours * 100) / 100,
      totalCost: Math.round(f.totalCost * 100) / 100,
      projectSummary: f.projects.map(p => `${p.project} (${p.hours}h)`).join(', '),
    }));

    return {
      freelancers,
      summary: {
        totalHours: Math.round(freelancers.reduce((s, f) => s + f.totalHours, 0) * 100) / 100,
        totalSpend: Math.round(freelancers.reduce((s, f) => s + f.totalCost, 0) * 100) / 100,
        freelancerCount: freelancers.length,
      },
    };
  }
  async getResourceAvailabilityReport(filters: ReportFiltersDto) {
    const targetDate = filters.startDate ? new Date(filters.startDate) : new Date();
    
    // Use AllocationsService to get the core availability data
    const availability = await this.allocationsService.getResourceAvailability(
      targetDate.toISOString(),
      undefined // We'll handle filtering by skill/dept here if needed, or use the DTO
    );

    // Add extra context if needed, such as department-wise filtering (though AllocationsService handles it)
    let filtered = availability;

    if (filters.userId) {
      filtered = filtered.filter(a => a.userId === filters.userId);
    }

    // Sort by most available first — no percentage anymore, just booked/free.
    return filtered.sort((a, b) => Number(a.isAllocated) - Number(b.isAllocated));
  }

  // ─── Detailed Timesheet-Entries Report (dynamic filters + Excel export) ────

  // A range filter on a value that isn't a direct column of `TimesheetEntry`
  // (planned effort is `COALESCE(task.plannedHours, task.estimatedEffort)`)
  // can't be expressed as a single Prisma `where` clause on that column — so
  // this expands the COALESCE into the two cases Prisma *can* filter on:
  // "plannedHours is set and within range" OR "plannedHours is unset and
  // estimatedEffort is within range".
  private buildPlannedEffortFilter(min?: number, max?: number): Prisma.TaskWhereInput | undefined {
    if (min === undefined && max === undefined) return undefined;
    const range = { gte: min, lte: max };
    return {
      OR: [
        { plannedHours: { not: null, ...range } },
        { plannedHours: null, estimatedEffort: range },
      ],
    };
  }

  // Matches either an employee's first/last name or a freelancer's full name —
  // a timesheet entry belongs to exactly one or the other (see the `username`/
  // `createdBy` derivation below), never both.
  private buildUserNameFilter(userName?: string): Prisma.TimesheetWhereInput | undefined {
    if (!userName) return undefined;
    return {
      OR: [
        {
          user: {
            OR: [
              { firstName: { contains: userName, mode: 'insensitive' } },
              { lastName: { contains: userName, mode: 'insensitive' } },
            ],
          },
        },
        { freelancer: { fullName: { contains: userName, mode: 'insensitive' } } },
      ],
    };
  }

  // Shared by the paginated GET and the Excel export — every filter here is
  // optional, so an empty `filters` object matches every entry.
  private buildDetailedEntriesWhere(filters: TimesheetEntriesQueryDto): Prisma.TimesheetEntryWhereInput {
    return {
      projectId: filters.projectId || undefined,
      project: filters.projectName
        ? { name: { contains: filters.projectName, mode: 'insensitive' } }
        : undefined,
      date: {
        gte: filters.startDate ? new Date(filters.startDate) : undefined,
        lte: filters.endDate ? new Date(filters.endDate) : undefined,
      },
      createdAt: {
        gte: filters.createdFrom ? new Date(filters.createdFrom) : undefined,
        lte: filters.createdTo ? new Date(filters.createdTo) : undefined,
      },
      hours: {
        gte: filters.minHours ?? undefined,
        lte: filters.maxHours ?? undefined,
      },
      task: this.buildPlannedEffortFilter(filters.minPlannedEffort, filters.maxPlannedEffort),
      timesheet: {
        userId: filters.userId || undefined,
        user: filters.isActive !== undefined ? { isActive: filters.isActive } : undefined,
        ...this.buildUserNameFilter(filters.userName),
      },
    };
  }

  // Row shape and submission-delay/maturity derivation shared by the
  // paginated GET and the Excel export, so the two can never drift apart.
  private async mapDetailedEntries(entries: DetailedEntry[]) {
    const SUBMITTED = ['SUBMITTED', 'RA_APPROVED', 'PM_APPROVED'];
    const dayMs = 86_400_000;

    const userIds = [
      ...new Set(entries.map((e) => e.timesheet?.userId).filter((id): id is string => !!id)),
    ];
    const maturityMap = await this.buildMaturityMap(userIds);

    return entries.map(e => {
      const ts = e.timesheet;
      const user = ts.user;
      const username = user
        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
        : ts.freelancer?.fullName ?? '';
      const createdBy = user?.email ?? ts.freelancer?.email ?? 'freelancer';

      // Submission delay: days between the timesheet period end and the moment
      // it was submitted (lastStatusChange is stamped on submit). Null if unsubmitted.
      let submissionDelay: number | null = null;
      if (SUBMITTED.includes(ts.status) && ts.endDate && ts.lastStatusChange) {
        const diff = Math.round(
          (new Date(ts.lastStatusChange).getTime() - new Date(ts.endDate).getTime()) / dayMs,
        );
        submissionDelay = Math.max(0, diff);
      }

      const maturity = e.timesheet?.userId
        ? maturityMap.get(this.maturityMonthKey(e.timesheet.userId, e.date)) ?? ''
        : '';

      return {
        created_by: createdBy,
        projectid: e.projectId,
        username,
        role: e.timesheet?.user?.role?.name ?? '',
        maturity,
        projectname: e.project?.name ?? '',
        taskid: e.taskId ?? '',
        taskname: e.task?.title ?? e.ticket?.title ?? '',
        tasktype: e.taskType,
        activity:
          e.activityMaster?.activity ??
          e.taskSubActivity?.activity?.name ??
          e.taskSubActivity?.name ??
          '',
        description: e.description ?? '',
        timespend: e.hours,
        effortsplanned: e.task?.plannedHours ?? e.task?.estimatedEffort ?? '',
        timesheetdate: e.date.toISOString().split('T')[0],
        timesheetcreateddate: e.createdAt.toISOString().split('T')[0],
        timesheet_submission_delay: submissionDelay ?? '',
      };
    });
  }

  // Full (unpaginated) result set — used only by the Excel export, which
  // needs every matching row in one workbook. Callers must guard this with
  // `assertExportableRowCount` first; it does not bound itself.
  async getTimesheetReportDetailed(filters: TimesheetEntriesQueryDto) {
    const entries = await this.prisma.timesheetEntry.findMany({
      where: this.buildDetailedEntriesWhere(filters),
      include: DETAILED_ENTRY_INCLUDE,
      orderBy: { date: 'desc' },
    });
    return this.mapDetailedEntries(entries);
  }

  // Paginated counterpart, used by the on-screen Timesheet Entries report.
  // Every filter is optional — an empty query returns page 1 of the full,
  // unfiltered dataset. Pagination (not a mandatory date range) is what keeps
  // this endpoint bounded.
  async getTimesheetReportDetailedPaginated(filters: TimesheetEntriesQueryDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const where = this.buildDetailedEntriesWhere(filters);

    const [entries, total, aggregate] = await this.prisma.$transaction([
      this.prisma.timesheetEntry.findMany({
        where,
        include: DETAILED_ENTRY_INCLUDE,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timesheetEntry.count({ where }),
      this.prisma.timesheetEntry.aggregate({ where, _sum: { hours: true } }),
    ]);

    const data = await this.mapDetailedEntries(entries);

    return {
      data,
      meta: {
        total,
        totalHours: aggregate._sum.hours ?? 0,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Guards the Excel export against building an unbounded workbook in memory —
  // see MAX_TIMESHEET_EXPORT_ROWS. The paginated GET doesn't need this; LIMIT/
  // OFFSET already bounds each response regardless of how wide the filters are.
  async assertExportableRowCount(filters: TimesheetEntriesQueryDto, reportLabel: string): Promise<void> {
    const total = await this.prisma.timesheetEntry.count({ where: this.buildDetailedEntriesWhere(filters) });
    if (total > MAX_TIMESHEET_EXPORT_ROWS) {
      throw new BadRequestException(
        `${reportLabel} export would include ${total} rows, which exceeds the ${MAX_TIMESHEET_EXPORT_ROWS.toLocaleString()}-row export limit — please narrow your filters (e.g. by date range or project) before exporting.`,
      );
    }
  }

  // ─── Monthly Efforts Logged Report (hours per project, cumulative) ─────────

  // Defaults to the end of the current month when no cutoff is given, mirroring
  // how getLeaveReport/getAttendanceReport resolve an implicit "this month".
  private resolveMonthlyEffortsAsOfDate(asOfDate?: string): Date {
    if (asOfDate) return new Date(asOfDate);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  private mapMonthlyEffortRows(rows: MonthlyEffortRawRow[]) {
    return rows.map((r) => ({
      projectName: r.name,
      totalHours: Number(r.total_hours),
      totalMinutes: Number(r.total_minutes),
    }));
  }

  // Paginated view for the on-screen report. Grouped by project (not by raw
  // entry), so `page`/`limit` page through project rows, not timesheet rows.
  async getMonthlyEffortsReport(query: MonthlyEffortsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const asOfDate = this.resolveMonthlyEffortsAsOfDate(query.asOfDate);
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<MonthlyEffortRawRow[]>`
        SELECT
          p.name,
          FLOOR(SUM(te.hours))                                    AS total_hours,
          ROUND((SUM(te.hours) - FLOOR(SUM(te.hours))) * 60)::int AS total_minutes
        FROM "TimesheetEntry" te
        LEFT JOIN "Project" p ON te."projectId" = p.id
        WHERE te.date <= ${asOfDate}
        GROUP BY p.name
        ORDER BY FLOOR(SUM(te.hours)) DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM (
          SELECT p.name
          FROM "TimesheetEntry" te
          LEFT JOIN "Project" p ON te."projectId" = p.id
          WHERE te.date <= ${asOfDate}
          GROUP BY p.name
        ) grouped
      `,
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      data: this.mapMonthlyEffortRows(rows),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  // Full (unpaginated) result set for the Excel export. Bounded by project
  // count (not entry count), which is small enough that no export row cap
  // is needed here the way it is for the timesheet-entries export.
  async getMonthlyEffortsReportAll(query: MonthlyEffortsQueryDto) {
    const asOfDate = this.resolveMonthlyEffortsAsOfDate(query.asOfDate);

    const rows = await this.prisma.$queryRaw<MonthlyEffortRawRow[]>`
      SELECT
        p.name,
        FLOOR(SUM(te.hours))                                    AS total_hours,
        ROUND((SUM(te.hours) - FLOOR(SUM(te.hours))) * 60)::int AS total_minutes
      FROM "TimesheetEntry" te
      LEFT JOIN "Project" p ON te."projectId" = p.id
      WHERE te.date <= ${asOfDate}
      GROUP BY p.name
      ORDER BY FLOOR(SUM(te.hours)) DESC
    `;

    return this.mapMonthlyEffortRows(rows);
  }

  // ─── Monthly Attendance Report (daily register, paginated + Excel export) ──

  // Defaults to the current month/year (evaluated in `timeZone`, not the
  // server process's local time) when neither is given, mirroring how
  // getAttendanceReport/getLeaveReport resolve an implicit "this month".
  // Returns plain 'YYYY-MM-DD' strings rather than JS `Date` objects — a
  // `Date` passed into `${start}::date` would be re-cast under the DB
  // session's time zone, reintroducing the same class of day-shift bug this
  // change fixes in the JOIN below. A date-only string literal has no such
  // ambiguity.
  private resolveMonthlyAttendanceRange(
    month: number | undefined,
    year: number | undefined,
    timeZone: string,
  ): { start: string; end: string } {
    const nowParts = getZonedDateParts(new Date(), timeZone);
    const y = year ?? nowParts.year;
    const m = month ?? nowParts.month;
    const pad = (n: number) => String(n).padStart(2, '0');
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    return {
      start: `${y}-${pad(m)}-01`,
      end: `${y}-${pad(m)}-${pad(daysInMonth)}`,
    };
  }

  // Every field is an optional narrowing filter on the employee side of the
  // cross join — applied inside the `all_users` CTE so it narrows the report
  // before the CROSS JOIN against the date series, not after.
  private buildMonthlyAttendanceUserFilter(query: MonthlyAttendanceQueryDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.departmentId) {
      conditions.push(Prisma.sql`"departmentId" = ${query.departmentId}`);
    }
    if (query.isActive !== undefined) {
      conditions.push(Prisma.sql`"isActive" = ${query.isActive}`);
    }
    if (query.userName) {
      const pattern = `%${query.userName}%`;
      conditions.push(Prisma.sql`("firstName" ILIKE ${pattern} OR "lastName" ILIKE ${pattern})`);
    }

    return conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
  }

  // Shared by both the paginated GET and the Excel export so their row shape
  // and day-matching logic can never drift apart (the caller appends
  // LIMIT/OFFSET, or doesn't, on top of this).
  //
  // Matches `a."date"` against the calendar day using each attendance
  // record's OWN `checkInTimeZone` (falling back to the report's requested
  // `timeZone` only for older rows that predate that column). Comparing via
  // a bare `a.date::date` — the previous implementation — casts using the
  // DB session's time zone instead of the zone the record was actually
  // logged in, silently shifting any non-UTC check-in onto the wrong day
  // (a record from just after midnight IST would land on the previous day's
  // row, or vice versa). That is exactly the class of bug the
  // `checkInTimeZone`/`getZonedDayRange` machinery in
  // attendance/time-zone.util.ts already exists to prevent elsewhere in this
  // module; this query just wasn't using it.
  private buildMonthlyAttendanceQuery(
    start: string,
    end: string,
    userFilter: Prisma.Sql,
    timeZone: string,
  ): Prisma.Sql {
    return Prisma.sql`
      WITH date_series AS (
        SELECT generate_series(${start}::date, ${end}::date, '1 day'::interval)::date AS calendar_date
      ),
      all_users AS (
        SELECT id, email, "firstName", "lastName", "isActive"
        FROM "User"
        WHERE ${userFilter}
      )
      SELECT
        TRIM(CONCAT(u."firstName", ' ', u."lastName")) AS employee_name,
        u.email AS username,
        CASE WHEN u."isActive" = true THEN 'Active' ELSE 'Inactive' END AS user_status,
        ds.calendar_date AS date,
        to_char(ds.calendar_date, 'FMDay') AS day_of_week,
        a."checkIn" AS check_in_time
      FROM all_users u
      CROSS JOIN date_series ds
      LEFT JOIN "Attendance" a
        ON a."userId" = u.id
        AND (a."date" AT TIME ZONE COALESCE(a."checkInTimeZone", ${timeZone}))::date = ds.calendar_date
      ORDER BY u."firstName" ASC, ds.calendar_date ASC
    `;
  }

  private mapMonthlyAttendanceRows(rows: MonthlyAttendanceRawRow[]) {
    return rows.map((r) => ({
      employeeName: r.employee_name,
      username: r.username,
      userStatus: r.user_status,
      date: r.date.toISOString().split('T')[0],
      dayOfWeek: r.day_of_week.trim(),
      checkInTime: r.check_in_time ? r.check_in_time.toISOString() : null,
    }));
  }

  // Paginated view for the on-screen report — one row per employee per
  // calendar day of the selected month, paginated by raw row (not grouped by
  // employee), so `page`/`limit` page straight through the flat register.
  async getMonthlyAttendanceReport(query: MonthlyAttendanceQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;
    const timeZone = resolveTimeZone(query.timeZone);
    const { start, end } = this.resolveMonthlyAttendanceRange(query.month, query.year, timeZone);
    const userFilter = this.buildMonthlyAttendanceUserFilter(query);
    const baseQuery = this.buildMonthlyAttendanceQuery(start, end, userFilter, timeZone);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<MonthlyAttendanceRawRow[]>(
        Prisma.sql`${baseQuery} LIMIT ${limit} OFFSET ${offset}`,
      ),
      this.prisma.$queryRaw<{ count: number }[]>`
        WITH date_series AS (
          SELECT generate_series(${start}::date, ${end}::date, '1 day'::interval)::date AS calendar_date
        ),
        all_users AS (
          SELECT id, "firstName", "isActive"
          FROM "User"
          WHERE ${userFilter}
        )
        SELECT COUNT(*)::int AS count FROM (
          SELECT u.id
          FROM all_users u
          CROSS JOIN date_series ds
        ) sub
      `,
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      data: this.mapMonthlyAttendanceRows(rows),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  // Full (unpaginated) result set for the Excel export. Bounded by
  // employee count × days-in-month — small enough (unlike the raw
  // TimesheetEntry table) that no export row cap is needed here, the same
  // reasoning as getMonthlyEffortsReportAll.
  async getMonthlyAttendanceReportAll(query: MonthlyAttendanceQueryDto) {
    const timeZone = resolveTimeZone(query.timeZone);
    const { start, end } = this.resolveMonthlyAttendanceRange(query.month, query.year, timeZone);
    const userFilter = this.buildMonthlyAttendanceUserFilter(query);

    const rows = await this.prisma.$queryRaw<MonthlyAttendanceRawRow[]>(
      this.buildMonthlyAttendanceQuery(start, end, userFilter, timeZone),
    );

    return this.mapMonthlyAttendanceRows(rows);
  }

  // ─── Attendance Compliance Report ────────────────────────────────────────────
  //
  // Flags employees who, on a working day, are missing ALL THREE of:
  //   1. a check-in — with no APPROVED AttendanceRegularization standing in for
  //      it, the same excuse AttendanceService.hasCheckedIn() honours when it
  //      gates timesheet entry creation, so an excused day is never flagged;
  //   2. a full-day leave covering that day (half-day leave does not count —
  //      the employee was still expected to work the other half); and
  //   3. a TimesheetEntry logged against one of their own timesheets that day.
  //
  // On (3): timesheets.service.ts refuses to create an entry unless
  // hasCheckedIn() is true, so in the normal flow (1) already implies (3) and
  // this predicate is belt-and-braces. It is still evaluated explicitly because
  // migrated rows and freelancer timesheets can carry entries with no matching
  // check-in, and because that gate is a product rule rather than a database
  // constraint. Do not "simplify" it away without checking those two cases.
  //
  // Days that are not working days for an employee — weekends, non-optional
  // public holidays, and weekdays outside their shift roster — are excluded
  // before any of this, otherwise the report would flag the whole company every
  // Saturday.
  //
  // Freelancers are out of scope by construction: the employee CTE reads only
  // "User", and the timesheet join goes through Timesheet.userId.

  // Resolve the range, filters and timezone once, so the paginated read and the
  // export are guaranteed to describe the same result set.
  private buildNonComplianceContext(query: NonComplianceQueryDto): NonComplianceQueryContext {
    const timeZone = resolveTimeZone(query.timeZone);
    const nowParts = getZonedDateParts(new Date(), timeZone);
    const today: DateParts = {
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
    };

    const range = resolveNonComplianceRange(query.startDate, query.endDate, today);
    if (!range.ok) {
      throw new BadRequestException(range.message);
    }

    // `timestamptz` columns (Attendance.date, AttendanceRegularization.date) are
    // matched against instants, and they are day-matched further down using each
    // record's OWN check-in zone. A record logged in a zone ahead of or behind
    // the report's could therefore have its local calendar day inside the range
    // while its instant sits just outside it. Padding the instant window by a
    // day on each side keeps such a record in scope while still giving the
    // planner a bounded, index-friendly range to scan.
    const rangeStartInstant = getUtcForZonedLocalDateTime(
      timeZone,
      range.start.year,
      range.start.month,
      range.start.day - 1,
    );
    const rangeEndInstant = getUtcForZonedLocalDateTime(
      timeZone,
      range.end.year,
      range.end.month,
      range.end.day + 2,
    );

    return {
      start: toDateKey(range.start),
      end: toDateKey(range.end),
      timeZone,
      rangeStartInstant,
      rangeEndInstant,
      includeWeekends: query.includeWeekends ?? false,
      includeHolidays: query.includeHolidays ?? false,
      // PENDING counts as "leave applied" by default: the employee did apply,
      // which is exactly what this report audits. Callers can narrow to
      // fully-approved leave only.
      leaveStatuses: query.includePendingLeave === false ? ['APPROVED'] : ['APPROVED', 'PENDING'],
      userFilter: this.buildNonComplianceUserFilter(query),
    };
  }

  // Optional narrowing filters on the employee side of the cross join, applied
  // inside the `employees` CTE so they narrow the report before it is expanded
  // across the date series rather than after.
  private buildNonComplianceUserFilter(query: NonComplianceQueryDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.departmentId) {
      conditions.push(Prisma.sql`u."departmentId" = ${query.departmentId}`);
    }
    if (query.userId) {
      conditions.push(Prisma.sql`u.id = ${query.userId}`);
    }
    if (query.userName) {
      const pattern = `%${query.userName}%`;
      conditions.push(
        Prisma.sql`(u."firstName" ILIKE ${pattern} OR u."lastName" ILIKE ${pattern} OR u."employeeCode" ILIKE ${pattern})`,
      );
    }

    return conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
  }

  // Builds the CTE chain shared by the paginated GET and the Excel export, so
  // the two can never drift apart — the caller appends ORDER BY + LIMIT/OFFSET,
  // or doesn't.
  //
  // Two comparison styles appear below, deliberately:
  //   * `timestamptz` columns (Attendance.date, AttendanceRegularization.date)
  //     are bounded by instants and day-matched with `AT TIME ZONE`, using the
  //     zone the record was actually logged in where one exists.
  //   * naive `timestamp` columns (Leave dates, TimesheetEntry.date,
  //     PublicHoliday.date, User.dateOfJoining) already store wall-clock time
  //     with no zone, so they are matched with a plain `::date`. Applying
  //     `AT TIME ZONE` to those would first reinterpret the value as UTC and
  //     then cast through the session's zone — shifting the day twice.
  private buildNonComplianceCtes(ctx: NonComplianceQueryContext): Prisma.Sql {
    const weekendFilter = ctx.includeWeekends
      ? Prisma.sql`TRUE`
      : Prisma.sql`EXTRACT(ISODOW FROM d.calendar_date) <= 5`;

    const holidayFilter = ctx.includeHolidays
      ? Prisma.sql`TRUE`
      : Prisma.sql`NOT EXISTS (
          SELECT 1
          FROM "PublicHoliday" ph
          WHERE ph."isOptional" = false
            AND ph."date"::date = d.calendar_date
        )`;

    return Prisma.sql`
      calendar AS (
        SELECT generate_series(${ctx.start}::date, ${ctx.end}::date, '1 day'::interval)::date AS calendar_date
      ),
      working_calendar AS (
        SELECT d.calendar_date
        FROM calendar d
        WHERE ${weekendFilter}
          AND ${holidayFilter}
      ),
      employees AS (
        SELECT
          u.id,
          u.email,
          u."employeeCode" AS employee_code,
          TRIM(CONCAT(COALESCE(u."firstName", ''), ' ', COALESCE(u."lastName", ''))) AS employee_name,
          d.name AS department,
          NULLIF(TRIM(CONCAT(COALESCE(ra."firstName", ''), ' ', COALESCE(ra."lastName", ''))), '') AS manager_name,
          u."dateOfJoining"::date AS joining_date,
          COALESCE(s."isActive", false) AS shift_is_active,
          COALESCE(cardinality(s."weekdays"), 0) AS shift_weekday_count,
          COALESCE(s."weekdays", ARRAY[]::text[]) AS shift_weekdays,
          s."startTime" AS shift_start_time
        FROM "User" u
        LEFT JOIN "Department" d ON d.id = u."departmentId"
        LEFT JOIN "User" ra ON ra.id = u."reportingAuthorityId"
        LEFT JOIN "Shift" s ON s.id = u."shiftId"
        WHERE u."isActive" = true
          AND u."employmentStatus" = 'ACTIVE'
          AND ${ctx.userFilter}
      ),
      employee_days AS (
        SELECT
          e.id,
          e.employee_code,
          e.employee_name,
          e.email,
          e.department,
          e.manager_name,
          e.shift_start_time,
          c.calendar_date
        FROM employees e
        CROSS JOIN working_calendar c
        WHERE
          -- Days before someone joined cannot be their non-compliance, and a
          -- NULL dateOfJoining (legacy rows) is treated as "always employed".
          (e.joining_date IS NULL OR e.joining_date <= c.calendar_date)
          -- An employee on a shift is only expected on that shift's weekdays.
          -- No shift, an inactive shift, or an empty roster all fall back to the
          -- Mon-Fri default already applied by working_calendar
          -- The CASE is spelled out rather than using to_char(..., 'DY') because
          -- that follows the database's lc_time and would silently stop
          -- matching Shift.weekdays on a non-English server.
          AND (
            e.shift_is_active = false
            OR e.shift_weekday_count = 0
            OR (CASE EXTRACT(ISODOW FROM c.calendar_date)
                  WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE' WHEN 3 THEN 'WED'
                  WHEN 4 THEN 'THU' WHEN 5 THEN 'FRI'
                  WHEN 6 THEN 'SAT' WHEN 7 THEN 'SUN'
                END) = ANY (e.shift_weekdays)
          )
      ),
      present_days AS (
        SELECT DISTINCT
          a."userId" AS user_id,
          (a."date" AT TIME ZONE COALESCE(a."checkInTimeZone", ${ctx.timeZone}))::date AS day_key
        FROM "Attendance" a
        JOIN employees e ON e.id = a."userId"
        WHERE a."checkIn" IS NOT NULL
          AND a."date" >= ${ctx.rangeStartInstant}
          AND a."date" < ${ctx.rangeEndInstant}
      ),
      regularized_days AS (
        SELECT DISTINCT
          r."userId" AS user_id,
          (r."date" AT TIME ZONE ${ctx.timeZone})::date AS day_key
        FROM "AttendanceRegularization" r
        JOIN employees e ON e.id = r."userId"
        WHERE r."status" = 'APPROVED'
          AND r."date" >= ${ctx.rangeStartInstant}
          AND r."date" < ${ctx.rangeEndInstant}
      ),
      leave_days AS (
        SELECT DISTINCT
          l."userId" AS user_id,
          c.calendar_date AS day_key
        FROM "Leave" l
        JOIN employees e ON e.id = l."userId"
        CROSS JOIN working_calendar c
        WHERE l."isHalfDay" = false
          AND l."status" IN (${Prisma.join(ctx.leaveStatuses)})
          AND l."startDate"::date <= c.calendar_date
          AND l."endDate"::date >= c.calendar_date
      ),
      timesheet_days AS (
        SELECT DISTINCT
          t."userId" AS user_id,
          te."date"::date AS day_key
        FROM "TimesheetEntry" te
        JOIN "Timesheet" t ON t.id = te."timesheetId"
        JOIN employees e ON e.id = t."userId"
        WHERE t."startDate"::date <= ${ctx.end}::date
          AND t."endDate"::date >= ${ctx.start}::date
          AND te."date"::date >= ${ctx.start}::date
          AND te."date"::date <= ${ctx.end}::date
      )
    `;
  }

  // The exception predicate itself: an employee-day is only returned when every
  // one of the four "excused" joins missed. Present == has an approved
  // regularization OR a check-in, which is why they are separate CTEs that are
  // both tested here.
  private buildNonComplianceSelect(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        d.employee_name,
        d.employee_code,
        d.email,
        d.department,
        d.manager_name,
        d.shift_start_time,
        to_char(d.calendar_date, 'YYYY-MM-DD') AS date,
        CASE EXTRACT(ISODOW FROM d.calendar_date)
          WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday' WHEN 7 THEN 'Sunday'
        END AS day_of_week
      FROM employee_days d
      LEFT JOIN present_days p ON p.user_id = d.id AND p.day_key = d.calendar_date
      LEFT JOIN regularized_days r ON r.user_id = d.id AND r.day_key = d.calendar_date
      LEFT JOIN leave_days l ON l.user_id = d.id AND l.day_key = d.calendar_date
      LEFT JOIN timesheet_days t ON t.user_id = d.id AND t.day_key = d.calendar_date
      WHERE p.user_id IS NULL
        AND r.user_id IS NULL
        AND l.user_id IS NULL
        AND t.user_id IS NULL
    `;
  }

  private buildNonComplianceQueryParts(ctx: NonComplianceQueryContext) {
    return {
      ctes: this.buildNonComplianceCtes(ctx),
      select: this.buildNonComplianceSelect(),
    };
  }

  private mapNonComplianceRows(rows: NonComplianceRawRow[]) {
    return rows.map((r) => ({
      employeeName: r.employee_name ?? '',
      employeeCode: r.employee_code ?? '',
      email: r.email,
      department: r.department ?? '',
      manager: r.manager_name ?? '',
      shiftStartTime: r.shift_start_time ?? '',
      date: r.date,
      dayOfWeek: r.day_of_week,
    }));
  }

  // Paginated view for the on-screen report — one row per employee per working
  // day they are flagged on, so `page`/`limit` walk the flat list directly.
  // The count re-runs the same CTEs and the same predicate, minus the ORDER BY,
  // so `meta.total` can never disagree with what the pages actually contain.
  async getNonComplianceReport(query: NonComplianceQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;
    const { ctes, select } = this.buildNonComplianceQueryParts(
      this.buildNonComplianceContext(query),
    );

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<NonComplianceRawRow[]>(
        Prisma.sql`WITH ${ctes} ${select}
          ORDER BY d.calendar_date ASC, d.employee_name ASC
          LIMIT ${limit} OFFSET ${offset}`,
      ),
      this.prisma.$queryRaw<{ count: number }[]>(
        Prisma.sql`WITH ${ctes} SELECT COUNT(*)::int AS count FROM (${select}) AS flagged`,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      data: this.mapNonComplianceRows(rows),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  // Full (unpaginated) result set for the Excel export. The row count is checked
  // against a ceiling first, the same guard-rail approach as
  // assertExportableRowCount on the detailed timesheet export, so a wide range
  // over a large headcount fails with an actionable message instead of
  // exhausting memory while building the workbook.
  async getNonComplianceReportAll(query: NonComplianceQueryDto) {
    const { ctes, select } = this.buildNonComplianceQueryParts(
      this.buildNonComplianceContext(query),
    );

    const countRows = await this.prisma.$queryRaw<{ count: number }[]>(
      Prisma.sql`WITH ${ctes} SELECT COUNT(*)::int AS count FROM (${select}) AS flagged`,
    );
    const total = countRows[0]?.count ?? 0;

    if (total > MAX_NON_COMPLIANCE_EXPORT_ROWS) {
      throw new BadRequestException(
        `This export would contain ${total} rows, which exceeds the ` +
          `${MAX_NON_COMPLIANCE_EXPORT_ROWS}-row limit. Narrow the date range or the ` +
          `department/employee filters and try again.`,
      );
    }

    const rows = await this.prisma.$queryRaw<NonComplianceRawRow[]>(
      Prisma.sql`WITH ${ctes} ${select}
        ORDER BY d.calendar_date ASC, d.employee_name ASC`,
    );

    return this.mapNonComplianceRows(rows);
  }



  // ─── Leave Report (3-sheet export) ──────────────────────────────────────────

  async getLeaveReport(month: number, year: number, departmentId?: string, userId?: string) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const now = new Date();

    const userFilter = {
      isActive: true,
      ...(departmentId ? { departmentId } : {}),
      ...(userId ? { id: userId } : {}),
    };

    const leaveUserFilter = {
      ...(departmentId ? { departmentId } : {}),
      ...(userId ? { id: userId } : {}),
    };

    const [users, leaves, balances, leaveTypes] = await Promise.all([
      this.prisma.user.findMany({
        where: userFilter,
        select: {
          id: true, firstName: true, lastName: true, email: true,
          department: { select: { name: true } },
          reportingAuthority: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.leave.findMany({
        where: {
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
          user: leaveUserFilter,
        },
        include: {
          user: {
            select: {
              id: true, firstName: true, lastName: true, email: true,
              department: { select: { name: true } },
              reportingAuthority: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.leaveBalance.findMany({
        where: { user: userFilter },
        include: {
          user: {
            select: {
              id: true, firstName: true, lastName: true, email: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.leaveTypeMaster.findMany(),
    ]);

    const typeMap = new Map(leaveTypes.map(t => [t.code, t]));
    const fullName = (u: { firstName: string | null; lastName: string | null } | null) =>
      u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';

    // ── Sheet 1: Summary by Department ──
    const deptAgg: Record<string, {
      department: string; totalDays: number; paidDays: number; unpaidDays: number;
      sandwichDays: number; pending: number; typeCounts: Record<string, number>;
    }> = {};
    const ensureDept = (name: string) => {
      if (!deptAgg[name]) deptAgg[name] = {
        department: name, totalDays: 0, paidDays: 0, unpaidDays: 0,
        sandwichDays: 0, pending: 0, typeCounts: {},
      };
      return deptAgg[name];
    };

    for (const lv of leaves) {
      const dept = lv.user.department?.name ?? 'Unassigned';
      const agg = ensureDept(dept);
      agg.totalDays += lv.duration;
      agg.sandwichDays += lv.sandwichDays;
      if (lv.status === 'PENDING') agg.pending += 1;
      const code = lv.leaveTypeCode ?? 'NA';
      agg.typeCounts[code] = (agg.typeCounts[code] ?? 0) + lv.duration;
      const isPaid = code !== 'NA' ? (typeMap.get(code)?.isPaid ?? true) : true;
      if (isPaid) agg.paidDays += lv.duration; else agg.unpaidDays += lv.duration;
    }

    const headcountByDept: Record<string, number> = {};
    for (const u of users) {
      const dept = u.department?.name ?? 'Unassigned';
      headcountByDept[dept] = (headcountByDept[dept] ?? 0) + 1;
    }
    const balanceByDept: Record<string, { earned: number; used: number }> = {};
    for (const b of balances) {
      const dept = b.user.department?.name ?? 'Unassigned';
      if (!balanceByDept[dept]) balanceByDept[dept] = { earned: 0, used: 0 };
      balanceByDept[dept].earned += b.earnedBalance;
      balanceByDept[dept].used += b.usedBalance;
    }

    const summary = Object.values(deptAgg).map(a => {
      const bal = balanceByDept[a.department] ?? { earned: 0, used: 0 };
      const topType = Object.entries(a.typeCounts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? '—';
      return {
        department: a.department,
        headcount: headcountByDept[a.department] ?? 0,
        totalLeaveDays: Math.round(a.totalDays * 100) / 100,
        paidDays: Math.round(a.paidDays * 100) / 100,
        unpaidDays: Math.round(a.unpaidDays * 100) / 100,
        utilizationPct: bal.earned > 0 ? Math.round((bal.used / bal.earned) * 100) : 0,
        sandwichDays: a.sandwichDays,
        topLeaveType: topType,
        pendingApprovals: a.pending,
      };
    }).sort((a, b) => b.totalLeaveDays - a.totalLeaveDays);

    // ── Sheet 2: Individual Leave Register ──
    const register = leaves.map(lv => ({
      employeeName: fullName(lv.user),
      email: lv.user.email,
      department: lv.user.department?.name ?? '—',
      reportingAuthority: fullName(lv.user.reportingAuthority) || '—',
      leaveType: lv.leaveTypeCode ?? '—',
      startDate: lv.startDate.toISOString().split('T')[0],
      endDate: lv.endDate.toISOString().split('T')[0],
      totalDays: lv.duration,
      halfDay: lv.isHalfDay ? (lv.halfDaySession ?? 'YES') : '—',
      status: lv.status,
      reason: lv.reason ?? '',
      applicationDate: lv.createdAt.toISOString().split('T')[0],
    }));

    // ── Sheet 3: Carry-Forward & Expiry Risk ──
    const carryForward = balances.map(b => {
      const available = b.earnedBalance - b.usedBalance;
      let expiringSoon = 0;
      if (b.expiryDate) {
        const days = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / 86_400_000);
        if (days >= 0 && days <= 90) expiringSoon = available > 0 ? available : 0;
      }
      return {
        employee: fullName(b.user),
        email: b.user.email,
        leaveType: b.leaveTypeCode,
        earned: b.earnedBalance,
        used: b.usedBalance,
        available: Math.round(available * 100) / 100,
        carriedForward: b.carryForward,
        expiryDate: b.expiryDate ? b.expiryDate.toISOString().split('T')[0] : '—',
        daysExpiringSoon: expiringSoon,
      };
    }).sort((a, b) => b.daysExpiringSoon - a.daysExpiringSoon);

    return { summary, register, carryForward };
  }

  // ─── Attendance / Clock-In Report (3-sheet export) ──────────────────────────

  async getAttendanceReport(month: number, year: number, departmentId?: string) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const [users, records, holidays, regs] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true, departmentId: departmentId || undefined },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          department: { select: { name: true } },
          shift: { select: { startTime: true, endTime: true } },
        },
      }),
      this.prisma.attendance.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          user: { departmentId: departmentId || undefined },
        },
        include: {
          user: {
            select: {
              id: true, firstName: true, lastName: true, email: true,
              department: { select: { name: true } },
              shift: { select: { startTime: true, endTime: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.publicHoliday.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
        select: { date: true },
      }),
      this.prisma.attendanceRegularization.groupBy({
        by: ['userId'],
        where: { date: { gte: monthStart, lte: monthEnd } },
        _count: { _all: true },
      }),
    ]);

    const userIds = users.map(u => u.id);

    // Approved regularizations excuse that specific day from counting as absent —
    // the same rule getMissingCheckinUsers already uses for the reminder cron.
    const approvedRegs = await this.prisma.attendanceRegularization.findMany({
      where: { status: 'APPROVED', userId: { in: userIds }, date: { gte: monthStart, lte: monthEnd } },
      select: { userId: true, date: true },
    });

    // Approved full-day leave excuses the day too; half-day leave still expects
    // a check-in, so it's excluded on purpose.
    const approvedLeaves = await this.prisma.leave.findMany({
      where: {
        status: 'APPROVED',
        isHalfDay: false,
        userId: { in: userIds },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { userId: true, startDate: true, endDate: true },
    });

    const fullName = (u: { firstName: string | null; lastName: string | null } | null) =>
      u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
    const dateKey = (d: Date) => d.toISOString().split('T')[0];
    const regCount = new Map(regs.map(r => [r.userId, r._count._all]));

    // Working days in the month (weekdays minus public holidays)
    const holidaySet = new Set(holidays.map(h => dateKey(h.date)));
    const workingDateList: string[] = [];
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6 && !holidaySet.has(dateKey(d))) workingDateList.push(dateKey(d));
    }
    const workingDays = workingDateList.length;

    // "Absent" is never written to the Attendance table — a row only exists when
    // someone checks in or gets a regularization approved. Absence has to be
    // derived per working day, mirroring the rule getMissingCheckinUsers already
    // uses for the reminder cron: no attendance row that day, not excused by an
    // approved regularization, and not on approved full-day leave. Never derived
    // for today or later — the day isn't over yet, so nobody's "absent" there.
    const todayKey = dateKey(new Date());
    const pastWorkingDates = workingDateList.filter(d => d < todayKey);

    const approvedRegDatesByUser = new Map<string, Set<string>>();
    for (const r of approvedRegs) {
      if (!approvedRegDatesByUser.has(r.userId)) approvedRegDatesByUser.set(r.userId, new Set());
      approvedRegDatesByUser.get(r.userId)!.add(dateKey(r.date));
    }
    const leaveRangesByUser = new Map<string, { start: Date; end: Date }[]>();
    for (const l of approvedLeaves) {
      if (!leaveRangesByUser.has(l.userId)) leaveRangesByUser.set(l.userId, []);
      leaveRangesByUser.get(l.userId)!.push({ start: l.startDate, end: l.endDate });
    }
    const isOnApprovedLeave = (userId: string, day: Date): boolean =>
      (leaveRangesByUser.get(userId) ?? []).some(r => day >= r.start && day <= r.end);

    // Convert "HH:MM" shift string + a check-in Date to minutes-late
    const minutesLate = (checkIn: Date | null, shiftStart?: string | null): number => {
      if (!checkIn || !shiftStart) return 0;
      const [sh, sm] = shiftStart.split(':').map(Number);
      const ci = new Date(checkIn);
      const scheduled = ci.getHours() * 60 + ci.getMinutes() - (sh * 60 + sm);
      return scheduled > 0 ? scheduled : 0;
    };

    // ── Sheet 1: Daily Attendance Summary ──
    const byDate: Record<string, {
      date: string; present: number; late: number; halfDay: number; absent: number;
      onLeave: number; wfh: number; overtime: number; checkInMins: number[];
    }> = {};
    const ensureDate = (key: string) => {
      if (!byDate[key]) byDate[key] = {
        date: key, present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0, wfh: 0, overtime: 0, checkInMins: [],
      };
      return byDate[key];
    };
    // Pre-seed every working day so a day with zero check-ins still appears —
    // with an accurate absent count — instead of silently vanishing from the sheet.
    pastWorkingDates.forEach(ensureDate);

    // "userId → dates with a real attendance row" — anyone active on a past
    // working day who isn't in here (and isn't excused) is genuinely absent.
    const coveredDatesByUser = new Map<string, Set<string>>();
    for (const r of records) {
      const key = dateKey(r.date);
      const row = ensureDate(key);
      if (r.status === 'PRESENT') row.present++;
      else if (r.status === 'LATE') row.late++;
      else if (r.status === 'HALF_DAY') row.halfDay++;
      if (r.isWfh) row.wfh++;
      row.overtime += r.overtimeHours;
      if (r.checkIn) {
        const ci = new Date(r.checkIn);
        row.checkInMins.push(ci.getHours() * 60 + ci.getMinutes());
      }
      if (!coveredDatesByUser.has(r.userId)) coveredDatesByUser.set(r.userId, new Set());
      coveredDatesByUser.get(r.userId)!.add(key);
    }

    // ── Per-user aggregation (Sheets 2 & 3) ──
    const perUser: Record<string, {
      user: (typeof records)[number]['user'];
      present: number; late: number; absent: number; halfDay: number; onLeave: number; wfh: number;
      overtime: number; lateMinutes: number[]; lateDates: string[];
    }> = {};
    const ensureUser = (u: (typeof records)[number]['user']) => {
      if (!perUser[u.id]) perUser[u.id] = {
        user: u, present: 0, late: 0, absent: 0, halfDay: 0, onLeave: 0, wfh: 0,
        overtime: 0, lateMinutes: [], lateDates: [],
      };
      return perUser[u.id];
    };
    // Seed every active user up front — someone who never checked in all month
    // previously vanished from the register entirely instead of showing as absent.
    users.forEach(ensureUser);
    for (const r of records) {
      const agg = ensureUser(r.user);
      if (r.status === 'PRESENT') agg.present++;
      else if (r.status === 'LATE') agg.late++;
      else if (r.status === 'HALF_DAY') agg.halfDay++;
      if (r.isWfh) agg.wfh++;
      agg.overtime += r.overtimeHours;
      if (r.status === 'LATE') {
        agg.lateMinutes.push(minutesLate(r.checkIn, r.user.shift?.startTime));
        agg.lateDates.push(dateKey(r.date));
      }
    }

    // ── Derive Absent / On Leave per past working day, per active user ──
    for (const dateStr of pastWorkingDates) {
      const day = new Date(`${dateStr}T00:00:00`);
      for (const u of users) {
        if (coveredDatesByUser.get(u.id)?.has(dateStr)) continue;       // checked in / half-day / WFH that day
        if (approvedRegDatesByUser.get(u.id)?.has(dateStr)) continue;   // excused by an approved regularization
        const dateRow = byDate[dateStr];
        const userAgg = perUser[u.id];
        if (isOnApprovedLeave(u.id, day)) {
          dateRow.onLeave++;
          userAgg.onLeave++;
        } else {
          dateRow.absent++;
          userAgg.absent++;
        }
      }
    }

    const fmtMins = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`;
    const dailySummary = Object.values(byDate).map(d => ({
      date: d.date,
      totalEmployees: users.length,
      present: d.present,
      late: d.late,
      halfDay: d.halfDay,
      absent: d.absent,
      onLeave: d.onLeave,
      wfh: d.wfh,
      avgCheckIn: d.checkInMins.length
        ? fmtMins(d.checkInMins.reduce((s, m) => s + m, 0) / d.checkInMins.length)
        : '—',
      totalOvertimeHours: Math.round(d.overtime * 100) / 100,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // ── Sheet 2: Individual Attendance Register (Monthly) ──
    const individual = Object.values(perUser).map(a => {
      const attendedDays = a.present + a.late + a.halfDay * 0.5;
      return {
        employeeName: fullName(a.user),
        email: a.user.email,
        department: a.user.department?.name ?? '—',
        shift: a.user.shift ? `${a.user.shift.startTime}–${a.user.shift.endTime}` : '—',
        workingDays,
        present: a.present,
        late: a.late,
        absent: a.absent,
        halfDay: a.halfDay,
        onLeaveDays: a.onLeave,
        wfhDays: a.wfh,
        totalOvertimeHours: Math.round(a.overtime * 100) / 100,
        attendancePct: workingDays > 0 ? Math.round((attendedDays / workingDays) * 100) : 0,
        regularizationRequests: regCount.get(a.user.id) ?? 0,
      };
    }).sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    // ── Sheet 3: Latecomer Analysis ──
    const maxConsecutive = (dates: string[]): number => {
      if (!dates.length) return 0;
      const sorted = [...dates].sort();
      let max = 1, run = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const cur = new Date(sorted[i]);
        const diff = (cur.getTime() - prev.getTime()) / 86_400_000;
        run = diff === 1 ? run + 1 : 1;
        if (run > max) max = run;
      }
      return max;
    };
    const latecomers = Object.values(perUser)
      .filter(a => a.late > 0)
      .map(a => ({
        employeeName: fullName(a.user),
        department: a.user.department?.name ?? '—',
        totalLateDays: a.late,
        avgLateByMinutes: a.lateMinutes.length
          ? Math.round(a.lateMinutes.reduce((s, m) => s + m, 0) / a.lateMinutes.length)
          : 0,
        maxConsecutiveLateDays: maxConsecutive(a.lateDates),
        regularizationCount: regCount.get(a.user.id) ?? 0,
      }))
      .sort((a, b) => b.totalLateDays - a.totalLateDays);

    return { dailySummary, individual, latecomers };
  }
}
