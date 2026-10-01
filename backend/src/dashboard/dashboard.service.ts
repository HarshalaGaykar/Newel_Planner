import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmploymentStatus, TimesheetStatus, WorkflowStatus } from '@prisma/client';
import dayjs from 'dayjs';
import { getZonedDayRange, resolveTimeZone } from '../attendance/time-zone.util';

type RagColor = 'GREEN' | 'AMBER' | 'RED';

interface KpiCache {
  data: any;
  ts: number;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function worstRag(...colors: RagColor[]): RagColor {
  if (colors.includes('RED')) return 'RED';
  if (colors.includes('AMBER')) return 'AMBER';
  return 'GREEN';
}

@Injectable()
export class DashboardService {
  private kpiCache = new Map<string, KpiCache>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private prisma: PrismaService) {}

  invalidateKpiCache() {
    this.kpiCache.delete('portfolio-kpis');
  }

  async getPortfolioKpis() {
    const cached = this.kpiCache.get('portfolio-kpis');
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) return cached.data;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfWeek = getMonday(now);

    const [
      projectsByStatusRaw,
      totalActiveUsers,
      pendingApprovals,
      atRiskMilestones,
      totalHoursAgg,
      benchCount,
      missingTimesheets,
      freelancerHoursRaw,
      avgMarginRaw,
      budgetExceededRaw,
    ] = await Promise.all([
      this.prisma.project.groupBy({ by: ['status'], _count: { id: true } }),

      this.prisma.user.count({ where: { employmentStatus: EmploymentStatus.ACTIVE } }),

      this.prisma.workflowInstance.count({ where: { status: WorkflowStatus.PENDING } }),

      this.prisma.milestone.count({
        where: { dueDate: { lt: now }, status: { not: 'ACHIEVED' } },
      }),

      this.prisma.timesheetEntry.aggregate({
        _sum: { hours: true },
        where: { timesheet: { startDate: { gte: thirtyDaysAgo } } },
      }),

      this.prisma.user.count({
        where: {
          employmentStatus: EmploymentStatus.ACTIVE,
          allocations: { none: { startDate: { lte: now }, endDate: { gte: now } } },
        },
      }),

      this.prisma.user.count({
        where: {
          employmentStatus: EmploymentStatus.ACTIVE,
          timesheets: {
            none: {
              startDate: { gte: startOfWeek },
              status: {
                in: [
                  TimesheetStatus.SUBMITTED,
                  TimesheetStatus.RA_APPROVED,
                  TimesheetStatus.PM_APPROVED,
                ],
              },
            },
          },
        },
      }),

      this.prisma.$queryRaw<[{ fl: number; total: number }]>`
        SELECT
          COALESCE(SUM(CASE WHEN t."freelancerId" IS NOT NULL THEN e.hours ELSE 0 END), 0)::float AS fl,
          COALESCE(SUM(e.hours), 0)::float AS total
        FROM "TimesheetEntry" e
        JOIN "Timesheet" t ON t.id = e."timesheetId"
        WHERE t."startDate" >= ${thirtyDaysAgo}
      `,

      this.prisma.$queryRaw<[{ avg_margin: number | null }]>`
        SELECT AVG(
          CASE WHEN p.revenue > 0
            THEN ((p.revenue - COALESCE(c.cost,0) - COALESCE(x.exp,0)) / p.revenue) * 100
            ELSE NULL END
        ) AS avg_margin
        FROM "Project" p
        LEFT JOIN (
          SELECT e."projectId", SUM(e.hours * u."baseCostPerHour") AS cost
          FROM "Timesheet" t
          JOIN "TimesheetEntry" e ON e."timesheetId" = t.id
          JOIN "User" u ON u.id = t."userId"
          WHERE t."userId" IS NOT NULL
          GROUP BY e."projectId"
        ) c ON c."projectId" = p.id
        LEFT JOIN (
          SELECT "projectId", SUM(amount) AS exp
          FROM "ProjectExpense"
          GROUP BY "projectId"
        ) x ON x."projectId" = p.id
        WHERE p.status = 'ACTIVE' AND p.revenue IS NOT NULL AND p.revenue > 0
      `,

      this.prisma.$queryRaw<[{ cnt: bigint }]>`
        SELECT COUNT(*)::bigint AS cnt
        FROM (
          SELECT p.id
          FROM "Project" p
          LEFT JOIN (
            SELECT e."projectId", SUM(e.hours * u."baseCostPerHour") AS cost
            FROM "Timesheet" t
            JOIN "TimesheetEntry" e ON e."timesheetId" = t.id
            JOIN "User" u ON u.id = t."userId"
            WHERE t."userId" IS NOT NULL
            GROUP BY e."projectId"
          ) c ON c."projectId" = p.id
          LEFT JOIN (
            SELECT "projectId", SUM(amount) AS exp
            FROM "ProjectExpense"
            GROUP BY "projectId"
          ) x ON x."projectId" = p.id
          WHERE p.status = 'ACTIVE' AND p."budgetCost" IS NOT NULL
            AND (COALESCE(c.cost,0) + COALESCE(x.exp,0)) > p."budgetCost"
        ) sub
      `,
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of projectsByStatusRaw) statusMap[row.status] = row._count.id;

    const totalProjects = statusMap['ACTIVE'] ?? 0;
    const totalHours = Number(totalHoursAgg._sum.hours ?? 0);
    const availableHours = totalActiveUsers * 22 * 8;
    const utilizationPct = availableHours > 0 ? (totalHours / availableHours) * 100 : 0;
    const benchPct = totalActiveUsers > 0 ? (benchCount / totalActiveUsers) * 100 : 0;
    const flRow = (freelancerHoursRaw as any[])[0] ?? { fl: 0, total: 0 };
    const freelancerDependencyPct =
      Number(flRow.total) > 0 ? (Number(flRow.fl) / Number(flRow.total)) * 100 : 0;
    const marginRow = (avgMarginRaw as any[])[0] ?? { avg_margin: null };
    const avgMargin = marginRow.avg_margin != null ? Number(marginRow.avg_margin) : null;
    const budgetRow = (budgetExceededRaw as any[])[0] ?? { cnt: 0n };
    const budgetExceeded = Number(budgetRow.cnt);

    const data = {
      totalProjects,
      projectsByStatus: {
        ACTIVE: statusMap['ACTIVE'] ?? 0,
        ON_HOLD: statusMap['ON_HOLD'] ?? 0,
        CLOSED: statusMap['CLOSED'] ?? 0,
        DRAFT: statusMap['DRAFT'] ?? 0,
      },
      utilizationPct: Math.round(utilizationPct * 10) / 10,
      benchPct: Math.round(benchPct * 10) / 10,
      pendingApprovals,
      missingTimesheets,
      freelancerDependencyPct: Math.round(freelancerDependencyPct * 10) / 10,
      avgMargin: avgMargin != null ? Math.round(avgMargin * 10) / 10 : null,
      atRiskMilestones,
      budgetExceeded,
    };

    this.kpiCache.set('portfolio-kpis', { data, ts: Date.now() });
    return data;
  }

  async getProjectHealthRag(projectId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [project, milestones, allocations, timesheets] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, budgetCost: true, revenue: true },
      }),
      this.prisma.milestone.findMany({
        where: { projectId, status: { not: 'ACHIEVED' }, dueDate: { lt: now } },
        select: { dueDate: true },
      }),
      this.prisma.allocation.findMany({
        where: { projectId, endDate: { gte: now } },
        select: { userId: true },
      }),
      this.prisma.timesheetEntry.aggregate({
        _sum: { hours: true },
        where: { projectId },
      }),
    ]);

    if (!project) throw new NotFoundException('Project not found');

    // Schedule RAG
    const maxDelay = milestones.reduce((max, m) => {
      const days = Math.floor((now.getTime() - new Date(m.dueDate!).getTime()) / 86400000);
      return Math.max(max, days);
    }, 0);
    const schedule: RagColor = maxDelay > 7 ? 'RED' : maxDelay > 0 ? 'AMBER' : 'GREEN';

    // Budget RAG
    const actualCost = Number(timesheets._sum.hours ?? 0);
    const budgetCost = project.budgetCost ?? 0;
    const burnRate = budgetCost > 0 ? (actualCost / budgetCost) * 100 : 0;
    const budget: RagColor = burnRate > 100 ? 'RED' : burnRate > 90 ? 'AMBER' : 'GREEN';

    // Resources RAG — no percentage anymore, so this just flags an active
    // project with nobody currently allocated to it.
    const resources: RagColor = allocations.length === 0 ? 'RED' : 'GREEN';

    const overall = worstRag(schedule, budget, resources);
    return { schedule, budget, resources, overall };
  }

  async getPmDashboard(pmId: string) {
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [projects, delayedTasks, upcomingMilestones] = await Promise.all([
      this.prisma.project.findMany({
        where: { pmId, status: 'ACTIVE' },
        include: {
          allocations: { where: { endDate: { gte: now } }, include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          milestones: { select: { id: true, name: true, dueDate: true, status: true, amount: true } },
          timesheetEntries: { select: { hours: true } },
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.task.findMany({
        where: {
          project: { pmId },
          endDate: { lt: now },
          status: { not: 'COMPLETED' },
        },
        select: {
          id: true, title: true, status: true, priority: true, endDate: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { endDate: 'asc' },
        take: 20,
      }),
      this.prisma.milestone.findMany({
        where: {
          project: { pmId },
          dueDate: { gte: now, lte: thirtyDaysOut },
          status: { not: 'ACHIEVED' },
        },
        select: { id: true, name: true, dueDate: true, status: true, project: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const projectsWithRag = await Promise.all(
      projects.map(async (p) => {
        const rag = await this.getProjectHealthRag(p.id);
        const actualCost = p.timesheetEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const budgetCost = p.budgetCost ?? 0;
        return {
          id: p.id,
          name: p.name,
          rag,
          allocationCount: p.allocations.length,
          budgetCost,
          actualCost,
          burnPct: budgetCost > 0 ? Math.round((actualCost / budgetCost) * 100) : 0,
        };
      }),
    );

    const allAllocatedUserIds = new Set(
      projects.flatMap((p) => p.allocations.map((a) => a.userId).filter(Boolean)),
    );
    const teamUtilizationData = await this.prisma.timesheetEntry.aggregate({
      _sum: { hours: true },
      where: {
        timesheet: {
          userId: { in: [...allAllocatedUserIds] as string[] },
          startDate: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
    });
    const teamHours = Number(teamUtilizationData._sum.hours ?? 0);
    const teamCapacity = allAllocatedUserIds.size * 22 * 8;
    const teamUtilization = teamCapacity > 0 ? Math.round((teamHours / teamCapacity) * 100) : 0;

    const burnRateByProject = projectsWithRag.map((p) => ({
      projectId: p.id,
      name: p.name,
      budgetCost: p.budgetCost,
      actualCost: p.actualCost,
      pct: p.burnPct,
    }));

    return {
      myProjects: projectsWithRag,
      teamUtilization,
      delayedTasks,
      burnRateByProject,
      upcomingMilestones,
    };
  }

  async getHrDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startOfWeek = getMonday(now);
    const endOfWeek = new Date(startOfWeek.getTime() + 5 * 24 * 60 * 60 * 1000);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    const [
      headcount,
      pendingLeaves,
      newJoinees,
      expiringContracts,
      leaveTrendRaw,
      attendanceThisWeek,
      topLeaveTakersRaw,
    ] = await Promise.all([
      this.prisma.user.count({ where: { employmentStatus: EmploymentStatus.ACTIVE } }),

      this.prisma.leave.count({ where: { status: 'PENDING' } }),

      this.prisma.user.findMany({
        where: { dateOfJoining: { gte: thirtyDaysAgo } },
        select: { id: true, firstName: true, lastName: true, dateOfJoining: true, designation: true },
        orderBy: { dateOfJoining: 'desc' },
      }),

      this.prisma.freelancer.findMany({
        where: {
          contractEnd: { lte: thirtyDaysOut, gte: now },
          status: 'ACTIVE',
        },
        select: { id: true, fullName: true, contractEnd: true, email: true },
        orderBy: { contractEnd: 'asc' },
      }),

      this.prisma.$queryRaw<{ week_start: Date; leave_count: bigint }[]>`
        SELECT
          DATE_TRUNC('week', "startDate") AS week_start,
          COUNT(*)::bigint AS leave_count
        FROM "Leave"
        WHERE "startDate" >= ${new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000)}
          AND status != 'REJECTED'
        GROUP BY week_start
        ORDER BY week_start
      `,

      this.prisma.attendance.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { date: { gte: startOfWeek, lt: endOfWeek } },
      }),

      this.prisma.$queryRaw<{ user_id: string; first_name: string; last_name: string; leave_days: number }[]>`
        SELECT
          u.id AS user_id,
          u."firstName" AS first_name,
          u."lastName" AS last_name,
          COALESCE(SUM(l.duration), 0)::float AS leave_days
        FROM "User" u
        JOIN "Leave" l ON l."userId" = u.id
        WHERE l."startDate" >= DATE_TRUNC('month', NOW()::timestamp)
          AND l.status != 'REJECTED'
        GROUP BY u.id, u."firstName", u."lastName"
        ORDER BY leave_days DESC
        LIMIT 5
      `,
    ]);

    const attendanceMap: Record<string, number> = {};
    for (const row of attendanceThisWeek) attendanceMap[row.status] = row._count.id;
    const wfhCount = await this.prisma.attendance.count({
      where: { date: { gte: startOfWeek, lt: endOfWeek }, isWfh: true },
    });

    const leaveTrend = (leaveTrendRaw as any[]).map((r) => ({
      weekStart: r.week_start,
      leaveCount: Number(r.leave_count),
    }));

    const topLeaveTakers = (topLeaveTakersRaw as any[]).map((r) => ({
      userId: r.user_id,
      name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      leaveDays: Number(r.leave_days),
    }));

    return {
      headcount,
      leaveTrend,
      attendanceThisWeek: {
        present: attendanceMap['PRESENT'] ?? 0,
        absent: attendanceMap['ABSENT'] ?? 0,
        late: attendanceMap['LATE'] ?? 0,
        wfh: wfhCount,
        totalWorkingDays: 5,
      },
      pendingLeaves,
      topLeaveTakers,
      newJoinees,
      expiringContracts,
    };
  }

  async getFinanceDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoSent = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalRevenueAgg,
      invoicesPending,
      overdueInvoices,
      monthlyTrendRaw,
      marginByProjectRaw,
      freelancerSpendRaw,
      employeeCostAgg,
      freelancerCostAgg,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        where: { status: 'PAID' },
      }),

      this.prisma.invoice.count({
        where: { status: { in: ['DRAFT', 'SENT'] } },
      }),

      this.prisma.invoice.findMany({
        where: {
          status: 'SENT',
          createdAt: { lt: thirtyDaysAgoSent },
        },
        select: { id: true, invoiceNo: true, total: true, createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),

      this.prisma.$queryRaw<{ month: string; revenue: number; cost: number }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', i."createdAt"), 'Mon YYYY') AS month,
          COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.total ELSE 0 END), 0)::float AS revenue,
          0::float AS cost
        FROM "Invoice" i
        WHERE i."createdAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', i."createdAt")
        ORDER BY DATE_TRUNC('month', i."createdAt")
      `,

      this.prisma.$queryRaw<{ project_id: string; project_name: string; revenue: number; actual_cost: number; margin: number }[]>`
        SELECT
          p.id AS project_id,
          p.name AS project_name,
          COALESCE(p.revenue, 0)::float AS revenue,
          (COALESCE(emp.cost, 0) + COALESCE(exp.total, 0))::float AS actual_cost,
          CASE WHEN COALESCE(p.revenue, 0) > 0
            THEN ((COALESCE(p.revenue,0) - COALESCE(emp.cost,0) - COALESCE(exp.total,0)) / p.revenue) * 100
            ELSE 0 END::float AS margin
        FROM "Project" p
        LEFT JOIN (
          SELECT e."projectId", SUM(e.hours * u."baseCostPerHour") AS cost
          FROM "Timesheet" t
          JOIN "TimesheetEntry" e ON e."timesheetId" = t.id
          JOIN "User" u ON u.id = t."userId"
          WHERE t."userId" IS NOT NULL
          GROUP BY e."projectId"
        ) emp ON emp."projectId" = p.id
        LEFT JOIN (
          SELECT "projectId", SUM(amount) AS total
          FROM "ProjectExpense"
          GROUP BY "projectId"
        ) exp ON exp."projectId" = p.id
        WHERE p.status = 'ACTIVE' AND p.revenue IS NOT NULL AND p.revenue > 0
        ORDER BY margin DESC
      `,

      this.prisma.$queryRaw<[{ spend: number }]>`
        SELECT COALESCE(SUM(e.hours * f."costPerHour"), 0)::float AS spend
        FROM "TimesheetEntry" e
        JOIN "Timesheet" t ON t.id = e."timesheetId"
        JOIN "Freelancer" f ON f.id = t."freelancerId"
        WHERE t."freelancerId" IS NOT NULL
          AND t."startDate" >= DATE_TRUNC('month', NOW()::timestamp)
      `,

      this.prisma.timesheetEntry.aggregate({
        _sum: { hours: true },
        where: {
          timesheet: {
            userId: { not: null },
            startDate: { gte: thirtyDaysAgo },
          },
        },
      }),

      this.prisma.timesheetEntry.aggregate({
        _sum: { hours: true },
        where: {
          timesheet: {
            freelancerId: { not: null },
            startDate: { gte: thirtyDaysAgo },
          },
        },
      }),
    ]);

    const marginRows = marginByProjectRaw as any[];
    const top5 = marginRows.slice(0, 5);
    const bottom5 = [...marginRows].sort((a, b) => a.margin - b.margin).slice(0, 5);

    const flSpendRow = (freelancerSpendRaw as any[])[0] ?? { spend: 0 };

    return {
      totalRevenue: Number(totalRevenueAgg._sum.total ?? 0),
      totalCost: 0,
      marginByProject: { top5, bottom5 },
      invoicesPending,
      overdueInvoices,
      monthlyRevenueVsCost: (monthlyTrendRaw as any[]).map((r) => ({
        month: r.month,
        revenue: Number(r.revenue),
        cost: Number(r.cost),
      })),
      freelancerSpendThisMonth: Number(flSpendRow.spend),
    };
  }

  async getUserDashboard(userId: string, timeZone?: string) {
    const now = new Date();
    const tz = resolveTimeZone(timeZone);
    const startOfWeek = getMonday(now);
    const lastWeekStart = new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayRange = getZonedDayRange(now, tz);

    const [
      myTasks,
      thisWeekTimesheets,
      lastWeekTimesheets,
      leaveBalances,
      activeLeaveTypes,
      myAllocations,
      todayAttendance,
    ] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          assigneeId: userId,
          status: { not: 'COMPLETED' },
        },
        select: {
          id: true, title: true, status: true, priority: true, endDate: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ priority: 'asc' }, { endDate: 'asc' }],
        take: 20,
      }),

      this.prisma.timesheet.findFirst({
        where: {
          userId,
          startDate: { gte: startOfWeek },
        },
        select: { id: true, status: true, startDate: true, endDate: true },
        orderBy: { startDate: 'desc' },
      }),

      this.prisma.timesheet.findFirst({
        where: {
          userId,
          startDate: { gte: lastWeekStart, lt: startOfWeek },
        },
        select: { id: true, status: true, startDate: true, endDate: true },
        orderBy: { startDate: 'desc' },
      }),

      this.prisma.leaveBalance.findMany({
        where: { userId },
        select: { leaveTypeCode: true, earnedBalance: true, usedBalance: true, carryForward: true },
      }),

      this.prisma.leaveTypeMaster.findMany({
        where: { isActive: true },
        select: { code: true, name: true },
        orderBy: { code: 'asc' },
      }),

      this.prisma.allocation.findMany({
        where: { userId, endDate: { gte: now } },
        select: {
          id: true, startDate: true, endDate: true,
          project: { select: { id: true, name: true, status: true } },
        },
      }),

      this.prisma.attendance.findFirst({
        where: { userId, date: { gte: todayRange.start, lt: todayRange.end } },
        select: { checkIn: true, checkOut: true, status: true, isWfh: true },
      }),
    ]);

    const balanceMap = new Map(leaveBalances.map((lb) => [lb.leaveTypeCode, lb]));

    return {
      myTasks,
      myTimesheetStatus: {
        thisWeek: thisWeekTimesheets?.status ?? null,
        lastWeek: lastWeekTimesheets?.status ?? null,
      },
      leaveBalance: activeLeaveTypes.map((lt) => {
        const lb = balanceMap.get(lt.code);
        return {
          type: lt.code,
          name: lt.name,
          available: (lb?.earnedBalance ?? 0) + (lb?.carryForward ?? 0) - (lb?.usedBalance ?? 0),
          earned: lb?.earnedBalance ?? 0,
          used: lb?.usedBalance ?? 0,
          carryForward: lb?.carryForward ?? 0,
        };
      }),
      myAllocations,
      todayAttendance: todayAttendance ?? { checkIn: null, checkOut: null, status: 'NOT_MARKED', isWfh: false },
    };
  }

  // Legacy methods kept for existing project-specific endpoints
  async getProjectKpis(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const [tasks, milestones, tickets] = await Promise.all([
      this.prisma.task.findMany({ where: { projectId }, select: { status: true } }),
      this.prisma.milestone.findMany({ where: { projectId }, select: { status: true } }),
      this.prisma.ticket.findMany({ where: { projectId }, select: { status: true, isSlaBreached: true } }),
    ]);

    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const resolvedTickets = tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;

    return {
      type: project.type,
      taskCompletionRate: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
      milestoneProgress: milestones.length > 0 ? (milestones.filter((m) => m.status === 'ACHIEVED').length / milestones.length) * 100 : 0,
      slaCompliance: tickets.length > 0 ? ((tickets.length - tickets.filter((t) => t.isSlaBreached).length) / tickets.length) * 100 : 100,
      totalTasks: tasks.length,
      completedTasks,
      totalTickets: tickets.length,
      resolvedTickets,
    };
  }

  async getTLDashboard(tlId: string) {
    const tl = await this.prisma.user.findUnique({ where: { id: tlId } });
    if (!tl?.departmentId) return { message: 'User not assigned to a department' };

    const now = new Date();
    const startOfWeek = getMonday(now);

    const [teamUsers, pendingLeaves, teamHoursAgg] = await Promise.all([
      this.prisma.user.count({ where: { departmentId: tl.departmentId, employmentStatus: EmploymentStatus.ACTIVE } }),

      this.prisma.leave.count({
        where: { user: { departmentId: tl.departmentId }, status: 'PENDING' },
      }),

      this.prisma.timesheetEntry.aggregate({
        _sum: { hours: true },
        where: {
          timesheet: {
            user: { departmentId: tl.departmentId },
            startDate: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
      }),
    ]);

    const pendingTimesheets = await this.prisma.user.count({
      where: {
        departmentId: tl.departmentId,
        employmentStatus: EmploymentStatus.ACTIVE,
        timesheets: {
          none: {
            startDate: { gte: startOfWeek },
            status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.RA_APPROVED, TimesheetStatus.PM_APPROVED] },
          },
        },
      },
    });

    const teamHours = Number(teamHoursAgg._sum.hours ?? 0);
    const teamCapacity = teamUsers * 22 * 8;
    const teamUtilization = teamCapacity > 0 ? Math.round((teamHours / teamCapacity) * 100) : 0;

    const [delayedTasks, pendingApprovals, upcomingLeaves] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          assignee: { departmentId: tl.departmentId },
          endDate: { lt: now },
          status: { not: 'COMPLETED' },
        },
        select: {
          id: true, title: true, status: true, priority: true, endDate: true,
          assignee: { select: { firstName: true, lastName: true } },
          project: { select: { name: true } },
        },
        orderBy: { endDate: 'asc' },
        take: 10,
      }),

      this.prisma.workflowInstance.count({
        where: { status: WorkflowStatus.PENDING, requester: { departmentId: tl.departmentId } },
      }),

      this.prisma.leave.findMany({
        where: {
          user: { departmentId: tl.departmentId },
          startDate: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
          status: 'APPROVED',
        },
        select: {
          startDate: true, endDate: true, duration: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    return {
      teamSize: teamUsers,
      pendingTimesheets,
      pendingLeaves,
      teamUtilization,
      delayedTasks,
      pendingApprovals,
      upcomingLeaves,
    };
  }

  async getProjectInsights(projectId: string, startDate?: string, endDate?: string, milestoneId?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const [project, tasks, milestones, tickets, allocations, timesheets, payments, testExecutions, changeRequests] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.task.findMany({ where: { projectId, milestoneId: milestoneId || undefined } }),
      this.prisma.milestone.findMany({ where: { projectId }, orderBy: { dueDate: 'asc' } }),
      this.prisma.ticket.findMany({ where: { projectId } }),
      this.prisma.allocation.findMany({ 
        where: { projectId }, 
        include: { user: { select: { firstName: true, lastName: true, baseCostPerHour: true } }, freelancer: { select: { fullName: true, costPerHour: true } } } 
      }),
      this.prisma.timesheetEntry.findMany({
        where: { 
          projectId,
          date: { gte: start, lte: end }
        },
        include: { timesheet: { include: { user: true, freelancer: true } }, activityMaster: true }
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { invoice: { projectId, status: 'PAID' } }
      }),
      this.prisma.testExecution.findMany({
        where: { run: { projectId } }
      }),
      this.prisma.changeRequest.findMany({
        where: { projectId }
      })
    ]);

    if (!project) throw new NotFoundException('Project not found');

    // 1. Health (Weighted by progress if available, otherwise count)
    const overallProgress = tasks.length > 0 
      ? tasks.reduce((sum, t) => sum + (t.progressPct || (t.status === 'COMPLETED' ? 100 : 0)), 0) / tasks.length
      : 0;

    // 2. Task Progress Counts
    const counts: Record<string, number> = {};
    tasks.forEach(t => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });

    // 3. Financials
    const actualCost = timesheets.reduce((sum, e) => {
      const rate = e.timesheet.user?.baseCostPerHour || e.timesheet.freelancer?.costPerHour || 0;
      return sum + (e.hours * rate);
    }, 0);
    
    // Sum milestones for budget if explicit budgetCost is missing
    const milestoneTotal = milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalBudget = project.budgetCost || milestoneTotal || 0;
    
    const totalPaid = Number((payments as any)._sum?.amount || 0); 
    const denominator = totalPaid > 0 ? totalPaid : (project.revenue || totalBudget || 0);
    const profitMargin = denominator > 0 ? ((denominator - actualCost) / denominator) * 100 : 0;

    // 4. Resource Bandwidth
    const resourceMap = new Map<string, { name: string, logged: number, expected: number }>();
    
    // Calculate working days in filter period or last 30 days
    const rangeStart = start ? dayjs(start) : dayjs().subtract(30, 'day');
    const rangeEnd = end ? dayjs(end) : dayjs();
    let workingDays = 0;
    let curr = rangeStart;
    while (curr.isBefore(rangeEnd) || curr.isSame(rangeEnd, 'day')) {
      if (curr.day() !== 0 && curr.day() !== 6) workingDays++;
      curr = curr.add(1, 'day');
    }

    allocations.forEach(a => {
      const name = a.user ? `${a.user.firstName} ${a.user.lastName}` : a.freelancer?.fullName || 'Unknown';
      const id = a.userId || a.freelancerId || 'unknown';
      // No percentage anymore — an allocation is a full-time commitment for
      // its date range, so expected hours are the full working-day total.
      const expected = workingDays * 8;
      resourceMap.set(id, { name, expected, logged: 0 });
    });
    
    timesheets.forEach(e => {
      const id = e.timesheet.userId || e.timesheet.freelancerId || 'unknown';
      if (resourceMap.has(id)) {
        resourceMap.get(id)!.logged += e.hours;
      }
    });

    // 5. Risks & Issues Breakdown
    const risksBreakdown = {
      severity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      status: { OPEN: 0, MITIGATING: 0, MITIGATED: 0, CLOSED: 0 }
    };
    // Note: Project model doesn't include risks/issues in the initial Promise.all fetch in current code, 
    // but the original code was accessing 'tickets' for some of this. 
    // Let's also fetch actual Risks and Issues if they exist.
    const [actualRisks, actualIssues] = await Promise.all([
      this.prisma.risk.findMany({ where: { projectId } }),
      this.prisma.issue.findMany({ where: { projectId } })
    ]);

    actualRisks.forEach(r => {
      if (r.status !== 'CLOSED') {
        const sev = r.impact === 'CRITICAL' ? 'CRITICAL' : r.impact;
        if (risksBreakdown.severity[sev] !== undefined) {
          risksBreakdown.severity[sev]++;
        }
        risksBreakdown.status[r.status] = (risksBreakdown.status[r.status] || 0) + 1;
      }
    });

    actualIssues.forEach(i => {
      if (i.status !== 'CLOSED' && i.status !== 'RESOLVED') {
        const sev = i.severity?.toUpperCase() || 'MEDIUM';
        if (risksBreakdown.severity[sev] !== undefined) {
          risksBreakdown.severity[sev]++;
        }
        risksBreakdown.status[i.status] = (risksBreakdown.status[i.status] || 0) + 1;
      }
    });

    // Add high-priority tasks to the breakdown as well
    tasks.forEach(t => {
      if (t.status !== 'COMPLETED' && (t.priority === 'HIGH' || t.priority === 'CRITICAL')) {
        const sev = t.priority.toUpperCase();
        if (risksBreakdown.severity[sev] !== undefined) {
          risksBreakdown.severity[sev]++;
        }
      }
    });

    const now = new Date();
    const overdueTasks = tasks.filter(t => {
      if (t.status === 'COMPLETED' || !t.endDate) return false;
      const end = new Date(t.endDate);
      return end < now;
    }).length;
    const slaBreaches = tickets.filter(t => t.isSlaBreached).length;
    const highPriorityBugsFromTickets = tickets.filter(t => {
      const type = t.type?.toUpperCase();
      const priority = t.priority?.toUpperCase();
      const isBug = type === 'BUG' || type === 'L3' || type === 'DEFECT';
      const isHighPriority = ['CRITICAL', 'HIGH', 'P1', 'P0', 'URGENT'].includes(priority);
      return isBug && isHighPriority;
    }).length;

    const highPriorityBugsFromTasks = tasks.filter(t => {
      const type = t.taskType?.toUpperCase();
      const priority = t.priority?.toUpperCase();
      // Expanded detection to include observations and general issues marked as high priority
      const isBug = ['BUG', 'DEFECT', 'OBSERVATION', 'ISSUE'].includes(type || '') || t.title?.toUpperCase().includes('BUG');
      const isHighPriority = ['CRITICAL', 'HIGH', 'P1', 'P0', 'URGENT'].includes(priority);
      return isBug && isHighPriority;
    }).length;

    const highPriorityBugs = highPriorityBugsFromTickets + highPriorityBugsFromTasks;

    // 6. Quality (Test Results)
    const testStats = {
      total: testExecutions.length,
      passed: testExecutions.filter(e => e.result?.toUpperCase() === 'PASSED').length,
      failed: testExecutions.filter(e => e.result?.toUpperCase() === 'FAILED').length,
      skipped: testExecutions.filter(e => {
        const res = e.result?.toUpperCase();
        return res === 'SKIPPED' || res === 'BLOCKED' || res === 'NOT_RUN';
      }).length,
    };
    
    const totalBugs = tickets.filter(t => {
      const type = t.type?.toUpperCase();
      return type === 'BUG' || type === 'L3' || type === 'DEFECT';
    }).length + tasks.filter(t => {
      const type = t.taskType?.toUpperCase();
      return ['BUG', 'DEFECT', 'OBSERVATION', 'ISSUE'].includes(type || '');
    }).length;
    const completedTasksCount = tasks.filter(t => t.status?.toUpperCase() === 'COMPLETED').length;
    const defectDensity = completedTasksCount > 0 ? totalBugs / completedTasksCount : totalBugs;

    const highPriorityTasks = tasks.filter(t => {
      const priority = t.priority?.toUpperCase();
      return (priority === 'CRITICAL' || priority === 'HIGH') && t.status !== 'COMPLETED';
    }).length;

    // 7. Change Requests
    const crSummary = {
      total: changeRequests.length,
      approved: changeRequests.filter(c => c.status === 'APPROVED' || c.status === 'CLOSED').length,
      pending: changeRequests.filter(c => c.status === 'SUBMITTED').length,
      budgetImpact: changeRequests.reduce((sum, c) => sum + (c.budgetDelta || 0), 0)
    };

    // 8. Productivity Trend
    const trendMap = new Map<string, { date: string, billable: number, nonBillable: number }>();
    timesheets.forEach(e => {
      const d = e.date.toISOString().split('T')[0];
      if (!trendMap.has(d)) trendMap.set(d, { date: d, billable: 0, nonBillable: 0 });
      const entry = trendMap.get(d)!;
      // Heuristic: If it has a taskId or ticketId, or if taskType is CHANGE_REQUEST, it's billable.
      const isBillable = !!(e.taskId || e.ticketId || e.taskType === 'CHANGE_REQUEST');
      if (isBillable) entry.billable += e.hours;
      else entry.nonBillable += e.hours;
    });
    const trend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 9. AI Risk Predictions (Heuristics)
    const aiPredictions: any[] = [];
    const dataCompleteness = Math.min(1, tasks.length / 10);
    
    // Schedule Risk
    const scheduleRisk = overdueTasks > 0 ? Math.min(0.9, (overdueTasks / (tasks.length || 1)) + 0.2) : 0.05;
    aiPredictions.push({
      module: 'Schedule',
      predictedValue: scheduleRisk > 0.4 ? 'High Risk of Delay' : 'On Track',
      confidence: 0.7 + (dataCompleteness * 0.25),
      riskScore: scheduleRisk
    });

    // Resource Risk
    const overAllocatedCount = Array.from(resourceMap.values()).filter(r => r.logged > r.expected * 1.1).length;
    aiPredictions.push({
      module: 'Resource',
      predictedValue: overAllocatedCount > 0 ? `${overAllocatedCount} resources over-utilized` : 'Stable Workload',
      confidence: 0.8 + (Math.min(1, allocations.length / 5) * 0.15),
      riskScore: overAllocatedCount / (allocations.length || 1)
    });

    // Budget Risk
    const budgetUtilization = totalBudget > 0 ? actualCost / totalBudget : 0;
    const progressToBudgetRatio = overallProgress > 0 ? budgetUtilization / (overallProgress / 100) : 1;
    aiPredictions.push({
      module: 'Budget',
      predictedValue: progressToBudgetRatio > 1.2 ? 'Potential Overrun' : 'Within Budget',
      confidence: 0.6 + (Math.min(1, timesheets.length / 50) * 0.3),
      riskScore: Math.min(1, Math.max(0, progressToBudgetRatio - 1))
    });

    return {
      health: { overallProgress },
      financials: { totalBudget, totalPaid, actualCost, profitMargin },
      resourceBandwidth: Array.from(resourceMap.values()).map(r => ({
        name: r.name,
        expectedHours: Math.round(r.expected),
        loggedHours: Math.round(r.logged)
      })),
      risks: { slaBreaches, overdueTasks, highPriorityBugs, highPriorityTasks, breakdown: risksBreakdown },
      quality: { defectDensity, totalBugs, testStats },
      taskProgress: { counts },
      productivity: { trend },
      changeRequests: crSummary,
      aiPredictions,
      timeline: milestones.map(m => ({
        id: m.id,
        name: m.name,
        dueDate: m.dueDate,
        status: m.status,
        completion: m.completion
      }))
    };
  }
}
