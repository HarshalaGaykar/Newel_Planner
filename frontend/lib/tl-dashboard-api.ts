import api from './api';

export type DashboardPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface TlTrend {
  currentPeriodCount: number;
  priorPeriodCount: number;
  /** null when there's no prior-period data to compare against — never a fake 0%. */
  trendPct: number | null;
  direction: 'UP' | 'DOWN' | 'FLAT' | 'NEW';
}

export interface TlStatCard {
  count: number;
  trend: TlTrend;
}

export interface TlStatsResponse {
  period: DashboardPeriod;
  windowStart: string;
  windowEnd: string;
  activeProjects: TlStatCard;
  leaveRequestsPending: TlStatCard;
  timesheetApprovalsPending: TlStatCard;
  totalResources: TlStatCard;
}

export interface StatusBucket {
  backlog: number;
  wip: number;
  done: number;
  total: number;
}

export interface TasksByStatusResponse {
  team: StatusBucket;
  mine: StatusBucket;
}

export interface LeaveCalendarEmployee {
  userId: string;
  name: string;
  leaveType: string;
  status: string;
  isHalfDay: boolean;
}

export interface LeaveCalendarDay {
  date: string; // YYYY-MM-DD
  employees: LeaveCalendarEmployee[];
}

export interface LeaveCalendarResponse {
  month: number;
  year: number;
  days: LeaveCalendarDay[];
}

export type GanttScope = 'ME' | 'MEMBER' | 'TEAM';
export type WithinEstimate = 'WITHIN' | 'OVER' | 'UNESTIMATED';

export interface GanttTaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  estimateHours: number | null;
  loggedHours: number;
  withinEstimate: WithinEstimate;
  variance: number | null;
  variancePct: number | null;
  progressPct: number;
  parentId: string | null;
  parent: { id: string; title: string } | null;
  project: { id: string; name: string };
  assignee: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface GanttResponse {
  data: GanttTaskRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface GanttQuery {
  scope?: GanttScope;
  memberId?: string;
  projectId?: string;
  status?: string;
  withinEstimate?: WithinEstimate;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sortBy?: 'endDate' | 'estimate' | 'logged' | 'variance';
  sortDir?: 'asc' | 'desc';
}

export const tlDashboardApi = {
  getStats: (period: DashboardPeriod) =>
    api.get<TlStatsResponse>('/tl-dashboard/stats', { params: { period } }).then((res) => res.data),

  getTasksByStatus: () =>
    api.get<TasksByStatusResponse>('/tl-dashboard/tasks-by-status').then((res) => res.data),

  getLeaveCalendar: (month: number, year: number) =>
    api.get<LeaveCalendarResponse>('/tl-dashboard/leave-calendar', { params: { month, year } }).then((res) => res.data),

  getGantt: (query: GanttQuery) => {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    );
    return api.get<GanttResponse>('/tl-dashboard/gantt', { params }).then((res) => res.data);
  },
};
