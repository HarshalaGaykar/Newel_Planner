import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmploymentStatus, TimesheetStatus, DemandStatus } from '@prisma/client';

@Injectable()
export class CapacityService {
  private readonly logger = new Logger(CapacityService.name);

  constructor(private prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private computeDailyHours(
    shift: { startTime: string; endTime: string; breakMinutes: number } | null,
    fallback: number,
  ): number {
    if (!shift) return fallback;
    const [sh, sm = 0] = shift.startTime.split(':').map(Number);
    const [eh, em = 0] = shift.endTime.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm) - shift.breakMinutes;
    return mins > 0 ? mins / 60 : fallback;
  }

  private countWorkingDays(start: Date, end: Date, holidays: Set<string>): number {
    let count = 0;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    while (d <= e) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6 && !holidays.has(d.toISOString().slice(0, 10))) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  private calcBenchDays(
    fromDate: Date,
    allocations: { startDate: Date; endDate: Date }[],
  ): number {
    let bench = 0;
    const d = new Date(fromDate);
    d.setHours(0, 0, 0, 0);
    const limit = new Date(d);
    limit.setFullYear(limit.getFullYear() - 1);

    while (d >= limit) {
      const hasAlloc = allocations.some(a => {
        const as = new Date(a.startDate);
        as.setHours(0, 0, 0, 0);
        const ae = new Date(a.endDate);
        ae.setHours(0, 0, 0, 0);
        return as <= d && ae >= d;
      });
      if (hasAlloc) break;
      bench++;
      d.setDate(d.getDate() - 1);
    }
    return bench;
  }

  // ── Snapshot Generation ────────────────────────────────────────────────────

  async generateSnapshot(month: number, year: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const [users, inMonthAllocations, timesheetEntries, publicHolidays, adminConfig] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { isActive: true, employmentStatus: EmploymentStatus.ACTIVE },
          include: { shift: true },
        }),
        this.prisma.allocation.findMany({
          where: {
            userId: { not: null },
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
          },
        }),
        this.prisma.timesheetEntry.findMany({
          where: {
            date: { gte: monthStart, lte: monthEnd },
            timesheet: {
              status: TimesheetStatus.PM_APPROVED,
              userId: { not: null },
            },
          },
          include: { timesheet: { select: { userId: true } } },
        }),
        this.prisma.publicHoliday.findMany({
          where: {
            date: { gte: monthStart, lte: monthEnd },
            isOptional: false,
          },
        }),
        this.prisma.adminConfig.findUnique({ where: { key: 'shift.daily_hours' } }),
      ]);

    const defaultDailyHours = adminConfig ? parseFloat(adminConfig.value) : 8;

    const allocByUser: Record<string, typeof inMonthAllocations> = {};
    for (const a of inMonthAllocations) {
      if (!a.userId) continue;
      (allocByUser[a.userId] ??= []).push(a);
    }

    const billableByUser: Record<string, number> = {};
    for (const e of timesheetEntries) {
      const uid = e.timesheet.userId;
      if (!uid) continue;
      billableByUser[uid] = (billableByUser[uid] ?? 0) + e.hours;
    }

    // All-time allocations per user for bench calculation
    const allTimeAllocations = await this.prisma.allocation.findMany({
      where: { userId: { in: users.map(u => u.id) } },
      select: { userId: true, startDate: true, endDate: true },
    });
    const allTimeByUser: Record<string, typeof allTimeAllocations> = {};
    for (const a of allTimeAllocations) {
      if (!a.userId) continue;
      (allTimeByUser[a.userId] ??= []).push(a);
    }

    const upserts = users.map(user => {
      const locationHolidays = publicHolidays.filter(
        h => h.isGlobal || h.locationId === user.locationId,
      );
      const holidaySet = new Set(locationHolidays.map(h => h.date.toISOString().slice(0, 10)));

      const workingDays = this.countWorkingDays(monthStart, monthEnd, holidaySet);
      const dailyHours = this.computeDailyHours(user.shift, defaultDailyHours);
      const availableHrs = workingDays * dailyHours;

      let allocatedHrs = 0;
      for (const alloc of allocByUser[user.id] ?? []) {
        const overlapStart = alloc.startDate > monthStart ? alloc.startDate : monthStart;
        const overlapEnd = alloc.endDate < monthEnd ? alloc.endDate : monthEnd;
        const allocDays = this.countWorkingDays(overlapStart, overlapEnd, holidaySet);
        allocatedHrs += allocDays * dailyHours;
      }

      const billableHrs = billableByUser[user.id] ?? 0;
      const utilizationPct =
        availableHrs > 0 ? Math.min((billableHrs / availableHrs) * 100, 100) : 0;
      const benchDays = this.calcBenchDays(monthEnd, allTimeByUser[user.id] ?? []);

      return this.prisma.capacitySnapshot.upsert({
        where: { userId_month_year: { userId: user.id, month, year } },
        create: {
          userId: user.id,
          month,
          year,
          workingDays,
          dailyHours,
          availableHrs,
          allocatedHrs,
          billableHrs,
          utilizationPct,
          benchDays,
        },
        update: {
          workingDays,
          dailyHours,
          availableHrs,
          allocatedHrs,
          billableHrs,
          utilizationPct,
          benchDays,
        },
      });
    });

    await Promise.all(upserts);
    this.logger.log(`Snapshotted ${users.length} users for ${month}/${year}`);
    return { snapshotted: users.length, month, year };
  }

  // ── Demand vs Supply ───────────────────────────────────────────────────────

  async getDemandVsSupply(month: number, year: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const snapshots = await this.prisma.capacitySnapshot.findMany({ where: { month, year } });

    let supplyHrs = 0, allocatedHrs = 0, billableHrs = 0;

    if (snapshots.length > 0) {
      supplyHrs = snapshots.reduce((s, n) => s + n.availableHrs, 0);
      allocatedHrs = snapshots.reduce((s, n) => s + n.allocatedHrs, 0);
      billableHrs = snapshots.reduce((s, n) => s + n.billableHrs, 0);
    } else {
      // Compute on-the-fly for months without snapshots
      const [users, allocations, adminConfig] = await Promise.all([
        this.prisma.user.findMany({
          where: { isActive: true, employmentStatus: EmploymentStatus.ACTIVE },
          include: { shift: true },
        }),
        this.prisma.allocation.findMany({
          where: {
            userId: { not: null },
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
          },
        }),
        this.prisma.adminConfig.findUnique({ where: { key: 'shift.daily_hours' } }),
      ]);

      const defaultDailyHours = adminConfig ? parseFloat(adminConfig.value) : 8;
      const allocByUser: Record<string, typeof allocations> = {};
      for (const a of allocations) {
        if (!a.userId) continue;
        (allocByUser[a.userId] ??= []).push(a);
      }

      for (const user of users) {
        const dailyHours = this.computeDailyHours(user.shift, defaultDailyHours);
        const workingDays = this.countWorkingDays(monthStart, monthEnd, new Set());
        supplyHrs += workingDays * dailyHours;

        for (const alloc of allocByUser[user.id] ?? []) {
          const overlapStart = alloc.startDate > monthStart ? alloc.startDate : monthStart;
          const overlapEnd = alloc.endDate < monthEnd ? alloc.endDate : monthEnd;
          const allocDays = this.countWorkingDays(overlapStart, overlapEnd, new Set());
          allocatedHrs += allocDays * dailyHours;
        }
      }
    }

    const pipelineCount = await this.prisma.demand.count({
      where: {
        status: DemandStatus.APPROVED,
        OR: [
          { estimatedTimeline: { gte: monthStart } },
          { estimatedTimeline: null },
        ],
      },
    });

    const avgUserCapacity =
      snapshots.length > 0 ? supplyHrs / Math.max(snapshots.length, 1) : 160;
    const pipelineHrs = pipelineCount * avgUserCapacity;
    const demandHrs = allocatedHrs + pipelineHrs;
    const gapHrs = supplyHrs - demandHrs;
    const utilizationPct = supplyHrs > 0 ? (billableHrs / supplyHrs) * 100 : 0;
    const allocationRate = supplyHrs > 0 ? (allocatedHrs / supplyHrs) * 100 : 0;

    return {
      month,
      year,
      supplyHrs: Math.round(supplyHrs),
      allocatedHrs: Math.round(allocatedHrs),
      billableHrs: Math.round(billableHrs),
      pipelineHrs: Math.round(pipelineHrs),
      pipelineCount,
      demandHrs: Math.round(demandHrs),
      gapHrs: Math.round(gapHrs),
      utilizationPct: Math.round(utilizationPct * 10) / 10,
      allocationRate: Math.round(allocationRate * 10) / 10,
    };
  }

  // ── Bench Pool ─────────────────────────────────────────────────────────────

  async getBenchPool() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await this.prisma.user.findMany({
      where: { isActive: true, employmentStatus: EmploymentStatus.ACTIVE },
      include: {
        allocations: true,
        skills: { include: { skill: { select: { name: true } } } },
      },
    });

    return users
      .map(user => {
        const activeAlloc = user.allocations.filter(a => {
          const s = new Date(a.startDate);
          s.setHours(0, 0, 0, 0);
          const e = new Date(a.endDate);
          e.setHours(0, 0, 0, 0);
          return s <= today && e >= today;
        });

        // No percentage anymore — bench means literally no active allocation today.
        if (activeAlloc.length > 0) return null;

        const pastAllocations = user.allocations
          .filter(a => new Date(a.endDate) < today)
          .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

        let benchSince: Date;
        if (pastAllocations.length > 0) {
          benchSince = new Date(pastAllocations[0].endDate);
          benchSince.setDate(benchSince.getDate() + 1);
        } else {
          benchSince = new Date(user.dateOfJoining ?? user.createdAt);
        }
        benchSince.setHours(0, 0, 0, 0);

        const benchDays = Math.max(
          0,
          Math.floor((today.getTime() - benchSince.getTime()) / 86_400_000),
        );

        return {
          id: user.id,
          name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
          employeeCode: user.employeeCode,
          designation: user.designation,
          skills: user.skills.map(s => s.skill.name),
          benchSince,
          benchDays,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.benchDays - a!.benchDays);
  }

  // ── Bench Aging ────────────────────────────────────────────────────────────

  async getBenchAging() {
    const pool = await this.getBenchPool();

    const groups = [
      { label: '< 7 days', color: 'green', min: 0, max: 7 },
      { label: '7–30 days', color: 'yellow', min: 7, max: 30 },
      { label: '30–90 days', color: 'orange', min: 30, max: 90 },
      { label: '> 90 days', color: 'red', min: 90, max: Infinity },
    ].map(g => ({
      ...g,
      count: pool.filter(u => u!.benchDays >= g.min && u!.benchDays < g.max).length,
      users: pool.filter(u => u!.benchDays >= g.min && u!.benchDays < g.max),
    }));

    return { total: pool.length, groups };
  }

  // ── Hiring Forecast ────────────────────────────────────────────────────────

  async getHiringForecast(months = 3) {
    const today = new Date();
    const adminConfig = await this.prisma.adminConfig.findUnique({
      where: { key: 'shift.daily_hours' },
    });
    const dailyHours = adminConfig ? parseFloat(adminConfig.value) : 8;
    const avgMonthlyCapacity = 20 * dailyHours;

    const activeUserCount = await this.prisma.user.count({
      where: { isActive: true, employmentStatus: EmploymentStatus.ACTIVE },
    });

    const forecast: {
      month: number; year: number; label: string;
      supplyHrs: number; demandHrs: number; gapHrs: number;
      pipelineDemands: number; recommendedHires: number;
      isGap: boolean; utilizationPct: number;
    }[] = [];

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthStart = new Date(monthDate);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const m = monthDate.getMonth() + 1;
      const y = monthDate.getFullYear();

      const workingDays = this.countWorkingDays(monthStart, monthEnd, new Set());
      const supplyHrs = activeUserCount * workingDays * dailyHours;

      const allocations = await this.prisma.allocation.findMany({
        where: {
          userId: { not: null },
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
      });

      let demandHrs = 0;
      for (const alloc of allocations) {
        const overlapStart = alloc.startDate > monthStart ? alloc.startDate : monthStart;
        const overlapEnd = alloc.endDate < monthEnd ? alloc.endDate : monthEnd;
        const allocDays = this.countWorkingDays(overlapStart, overlapEnd, new Set());
        demandHrs += allocDays * dailyHours;
      }

      const pipelineDemands = await this.prisma.demand.count({
        where: {
          status: DemandStatus.APPROVED,
          OR: [
            { estimatedTimeline: { gte: monthStart } },
            { estimatedTimeline: null },
          ],
        },
      });

      const gapHrs = supplyHrs - demandHrs;
      const recommendedHires = gapHrs < 0 ? Math.ceil(Math.abs(gapHrs) / avgMonthlyCapacity) : 0;

      forecast.push({
        month: m,
        year: y,
        label: monthDate.toLocaleString('en', { month: 'short', year: '2-digit' }),
        supplyHrs: Math.round(supplyHrs),
        demandHrs: Math.round(demandHrs),
        gapHrs: Math.round(gapHrs),
        pipelineDemands,
        recommendedHires,
        isGap: gapHrs < 0,
        utilizationPct: supplyHrs > 0 ? Math.round((demandHrs / supplyHrs) * 100) : 0,
      });
    }

    return forecast;
  }

  // ── Utilization Trend ──────────────────────────────────────────────────────

  async getUtilizationTrend(months = 6) {
    const today = new Date();
    const result: {
      month: number; year: number; label: string;
      utilizationPct: number; allocationPct: number;
      totalAvailableHrs: number; totalBillableHrs: number; totalAllocatedHrs: number;
    }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });

      const snapshots = await this.prisma.capacitySnapshot.findMany({
        where: { month: m, year: y },
      });

      const totalAvailableHrs = snapshots.reduce((s, n) => s + n.availableHrs, 0);
      const totalBillableHrs = snapshots.reduce((s, n) => s + n.billableHrs, 0);
      const totalAllocatedHrs = snapshots.reduce((s, n) => s + n.allocatedHrs, 0);
      const utilizationPct =
        totalAvailableHrs > 0 ? (totalBillableHrs / totalAvailableHrs) * 100 : 0;
      const allocationPct =
        totalAvailableHrs > 0 ? (totalAllocatedHrs / totalAvailableHrs) * 100 : 0;

      result.push({
        month: m,
        year: y,
        label,
        utilizationPct: Math.round(utilizationPct * 10) / 10,
        allocationPct: Math.round(allocationPct * 10) / 10,
        totalAvailableHrs: Math.round(totalAvailableHrs),
        totalBillableHrs: Math.round(totalBillableHrs),
        totalAllocatedHrs: Math.round(totalAllocatedHrs),
      });
    }

    return result;
  }

  // ── Snapshot Grid ──────────────────────────────────────────────────────────

  async getSnapshot(month: number, year: number) {
    return this.prisma.capacitySnapshot.findMany({
      where: { month, year },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
  }

  async getCapacityGrid(months = 6) {
    const today = new Date();
    const monthKeys = Array.from({ length: months }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
      return {
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: d.toLocaleString('en', { month: 'short', year: '2-digit' }),
      };
    });

    const [snapshots, users] = await Promise.all([
      this.prisma.capacitySnapshot.findMany({
        where: { OR: monthKeys.map(mk => ({ month: mk.month, year: mk.year })) },
      }),
      this.prisma.user.findMany({
        where: { isActive: true, employmentStatus: EmploymentStatus.ACTIVE },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          designation: true,
        },
        orderBy: { firstName: 'asc' },
      }),
    ]);

    const snapMap = new Map<
      string,
      { utilizationPct: number; allocatedHrs: number; availableHrs: number }
    >();
    for (const s of snapshots) {
      snapMap.set(`${s.userId}:${s.month}:${s.year}`, {
        utilizationPct: s.utilizationPct,
        allocatedHrs: s.allocatedHrs,
        availableHrs: s.availableHrs,
      });
    }

    return {
      months: monthKeys,
      users: users.map(u => ({
        ...u,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        months: monthKeys.map(
          mk =>
            snapMap.get(`${u.id}:${mk.month}:${mk.year}`) ?? {
              utilizationPct: 0,
              allocatedHrs: 0,
              availableHrs: 0,
            },
        ),
      })),
    };
  }

  // ── Effort-Driven Allocation Dashboard ───────────────────────────────────────
  // Read-only view: derives each employee's monthly bandwidth from time-phased
  // task effort (estimatedEffort spread across the task's planned working days),
  // broken down per project. Ignores the manual Allocation table entirely.

  async getAllocationDashboard(month: number, year: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const TERMINAL_STATUSES = ['DONE', 'COMPLETED', 'CLOSED', 'CANCELLED'];
    const round = (n: number) => Math.round(n * 10) / 10;

    const [users, publicHolidays, adminConfig, tasks, approvedLeaves, tasksMissingEffort] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { isActive: true, employmentStatus: EmploymentStatus.ACTIVE },
          include: {
            shift: true,
            role: { select: { name: true } },
            department: { select: { name: true } },
          },
          orderBy: { firstName: 'asc' },
        }),
        this.prisma.publicHoliday.findMany({
          where: { date: { gte: monthStart, lte: monthEnd }, isOptional: false },
        }),
        this.prisma.adminConfig.findUnique({ where: { key: 'shift.daily_hours' } }),
        // Candidate tasks: have effort, not terminal, leaf-level only (no subtasks).
        this.prisma.task.findMany({
          where: {
            estimatedEffort: { not: null },
            status: { notIn: TERMINAL_STATUSES },
            subTasks: { none: {} },
          },
          select: {
            id: true,
            estimatedEffort: true,
            plannedStart: true,
            plannedEnd: true,
            startDate: true,
            endDate: true,
            projectId: true,
            project: { select: { id: true, name: true } },
            assigneeId: true,
            taskAssignees: { select: { userId: true } },
          },
        }),
        this.prisma.leave.findMany({
          where: {
            status: 'APPROVED',
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
          },
          select: { userId: true, startDate: true, endDate: true },
        }),
        // Trustworthiness signal: active leaf tasks touching the month with no effort set.
        this.prisma.task.count({
          where: {
            estimatedEffort: null,
            status: { notIn: TERMINAL_STATUSES },
            subTasks: { none: {} },
            OR: [
              { plannedStart: { lte: monthEnd }, plannedEnd: { gte: monthStart } },
              { startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
            ],
          },
        }),
      ]);

    const defaultDailyHours = adminConfig ? parseFloat(adminConfig.value) : 8;
    const globalHolidaySet = new Set(
      publicHolidays.map(h => h.date.toISOString().slice(0, 10)),
    );

    // userId -> (projectId -> { projectId, projectName, hrs })
    const contributions = new Map<
      string,
      Map<string, { projectId: string; projectName: string; hrs: number }>
    >();
    const addContribution = (
      userId: string,
      projectId: string,
      projectName: string,
      hrs: number,
    ) => {
      let byProject = contributions.get(userId);
      if (!byProject) {
        byProject = new Map();
        contributions.set(userId, byProject);
      }
      const existing = byProject.get(projectId);
      if (existing) existing.hrs += hrs;
      else byProject.set(projectId, { projectId, projectName, hrs });
    };

    let tasksMissingDates = 0;

    for (const task of tasks) {
      const start = task.plannedStart ?? task.startDate;
      const end = task.plannedEnd ?? task.endDate;
      if (!start || !end || start > end) {
        tasksMissingDates++;
        continue;
      }

      const taskWorkingDays = this.countWorkingDays(start, end, globalHolidaySet);
      if (taskWorkingDays === 0) {
        tasksMissingDates++;
        continue;
      }

      const overlapStart = start > monthStart ? start : monthStart;
      const overlapEnd = end < monthEnd ? end : monthEnd;
      if (overlapStart > overlapEnd) continue; // task does not touch this month
      const monthWorkingDays = this.countWorkingDays(overlapStart, overlapEnd, globalHolidaySet);
      if (monthWorkingDays === 0) continue;

      const assigneeIds = new Set<string>();
      if (task.assigneeId) assigneeIds.add(task.assigneeId);
      for (const ta of task.taskAssignees) assigneeIds.add(ta.userId);
      if (assigneeIds.size === 0) continue; // unassigned — nobody to attribute

      const perWorkingDay = (task.estimatedEffort as number) / taskWorkingDays;
      const taskMonthHrs = perWorkingDay * monthWorkingDays;
      const perAssignee = taskMonthHrs / assigneeIds.size;

      for (const uid of assigneeIds) {
        addContribution(uid, task.projectId, task.project.name, perAssignee);
      }
    }

    const leavesByUser = new Map<string, { startDate: Date; endDate: Date }[]>();
    for (const lv of approvedLeaves) {
      const arr = leavesByUser.get(lv.userId) ?? [];
      arr.push({ startDate: lv.startDate, endDate: lv.endDate });
      leavesByUser.set(lv.userId, arr);
    }

    const resources = users.map(user => {
      const holidaySet = new Set(
        publicHolidays
          .filter(h => h.isGlobal || h.locationId === user.locationId)
          .map(h => h.date.toISOString().slice(0, 10)),
      );
      const workingDays = this.countWorkingDays(monthStart, monthEnd, holidaySet);
      const dailyHours = this.computeDailyHours(user.shift, defaultDailyHours);
      const grossCapacityHrs = workingDays * dailyHours;

      let leaveWorkingDays = 0;
      for (const lv of leavesByUser.get(user.id) ?? []) {
        const ls = lv.startDate > monthStart ? lv.startDate : monthStart;
        const le = lv.endDate < monthEnd ? lv.endDate : monthEnd;
        if (ls > le) continue;
        leaveWorkingDays += this.countWorkingDays(ls, le, holidaySet);
      }
      leaveWorkingDays = Math.min(leaveWorkingDays, workingDays);
      const leaveHrs = leaveWorkingDays * dailyHours;
      const capacityHrs = Math.max(0, grossCapacityHrs - leaveHrs);

      const byProject = contributions.get(user.id);
      const rawProjects = byProject ? Array.from(byProject.values()) : [];
      const rawAllocated = rawProjects.reduce((s, p) => s + p.hrs, 0);

      const projects = rawProjects
        .map(p => ({
          projectId: p.projectId,
          projectName: p.projectName,
          hrs: round(p.hrs),
          pct: capacityHrs > 0 ? Math.round((p.hrs / capacityHrs) * 100) : 0,
        }))
        .filter(p => p.hrs > 0) // drop negligible slices that round to 0h
        .sort((a, b) => b.hrs - a.hrs);

      return {
        userId: user.id,
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        role: user.role?.name ?? '',
        department: user.department?.name ?? '',
        workingDays,
        dailyHours,
        capacityHrs: round(capacityHrs),
        leaveHrs: round(leaveHrs),
        allocatedHrs: round(rawAllocated),
        freeHrs: round(capacityHrs - rawAllocated),
        utilizationPct: capacityHrs > 0 ? Math.round((rawAllocated / capacityHrs) * 100) : 0,
        overAllocated: rawAllocated > capacityHrs,
        projects,
      };
    });

    return {
      month,
      year,
      resources,
      warnings: { tasksMissingDates, tasksMissingEffort },
    };
  }
}
