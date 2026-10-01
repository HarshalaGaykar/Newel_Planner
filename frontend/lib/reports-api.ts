import api from './api';
import { API_BASE_URL } from './api-url';

export interface TimesheetReportFilters {
  startDate: string;
  endDate: string;
  // Empty string means "no filter" (not sent) — see activeParams below.
  projectId: string;
  userId: string;
}

export interface TimesheetReportEntry {
  id: string;
  date: string;
  hours: number;
  description: string | null;
  roleName: string | null;
  maturityValue: number | null;
  project: { name: string };
  task: { title: string } | null;
  ticket: { title: string } | null;
  timesheet: { user: { email: string } | null };
}

export interface TimesheetReportMeta {
  total: number;
  totalHours: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TimesheetReportResponse {
  data: TimesheetReportEntry[];
  meta: TimesheetReportMeta;
}

export interface TimesheetEntriesFilters {
  // Every field is optional — an empty object returns the full (paginated)
  // dataset. Empty string / undefined means "no filter" (not sent).
  startDate?: string;
  endDate?: string;
  createdFrom?: string;
  createdTo?: string;
  projectId?: string;
  projectName?: string;
  userId?: string;
  userName?: string;
  // 'true' / 'false' / '' (all) — kept as a string so it round-trips cleanly
  // through a <select>; converted to a real boolean only when sent.
  isActive?: '' | 'true' | 'false';
  minHours?: number | '';
  maxHours?: number | '';
  minPlannedEffort?: number | '';
  maxPlannedEffort?: number | '';
}

export interface TimesheetEntryDetailRow {
  created_by: string;
  projectid: string | null;
  username: string;
  role: string;
  maturity: number | string;
  projectname: string;
  taskid: string;
  taskname: string;
  tasktype: string;
  activity: string;
  description: string;
  timespend: number;
  effortsplanned: number | string;
  timesheetdate: string;
  timesheetcreateddate: string;
  timesheet_submission_delay: number | string;
}

export interface TimesheetEntriesResponse {
  data: TimesheetEntryDetailRow[];
  meta: TimesheetReportMeta;
}

export interface MonthlyEffortsFilters {
  // Cumulative cutoff date — defaults server-side to the end of the current
  // month when omitted.
  asOfDate?: string;
}

export interface MonthlyEffortRow {
  projectName: string | null;
  totalHours: number;
  totalMinutes: number;
}

export interface MonthlyEffortsMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MonthlyEffortsResponse {
  data: MonthlyEffortRow[];
  meta: MonthlyEffortsMeta;
}

export interface AttendanceReportFilters {
  month: string;
  year: string;
  // Empty string means "all departments" (not sent) — see activeParams below.
  departmentId: string;
}

export interface AttendanceDepartment {
  id: string;
  name: string;
}

export interface AttendanceDailySummaryRow {
  date: string;
  totalEmployees: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  wfh: number;
  avgCheckIn: string;
  totalOvertimeHours: number;
}

export interface AttendanceIndividualRow {
  employeeName: string;
  email: string;
  department: string;
  shift: string;
  workingDays: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  onLeaveDays: number;
  wfhDays: number;
  totalOvertimeHours: number;
  attendancePct: number;
  regularizationRequests: number;
}

export interface AttendanceLatecomerRow {
  employeeName: string;
  department: string;
  totalLateDays: number;
  avgLateByMinutes: number;
  maxConsecutiveLateDays: number;
  regularizationCount: number;
}

export interface AttendanceReportResponse {
  dailySummary: AttendanceDailySummaryRow[];
  individual: AttendanceIndividualRow[];
  latecomers: AttendanceLatecomerRow[];
}

export interface MonthlyAttendanceFilters {
  month: string;
  year: string;
  // Empty string means "all departments" / "all statuses" / "no name filter"
  // (not sent) — see activeParams below.
  departmentId: string;
  userName: string;
  isActive: '' | 'true' | 'false';
  // The viewer's IANA time zone (e.g. "Asia/Kolkata") — the backend uses it to
  // resolve which calendar day a check-in belongs to. Without this, the
  // report's day-matching falls back to each attendance record's own stored
  // zone, then UTC, which can shift a check-in onto the wrong day for a
  // viewer expecting their own local calendar.
  timeZone: string;
}

export interface MonthlyAttendanceRow {
  employeeName: string | null;
  username: string;
  userStatus: string;
  date: string;
  dayOfWeek: string;
  checkInTime: string | null;
}

export interface MonthlyAttendanceMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MonthlyAttendanceResponse {
  data: MonthlyAttendanceRow[];
  meta: MonthlyAttendanceMeta;
}

// Drops empty/null/undefined values so unset filters aren't sent as blank
// query params (the backend treats an empty string differently from an
// absent one for optional filters).
function activeParams(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
}

export const reportsApi = {
  getTimesheetReportPaginated: (filters: TimesheetReportFilters, page: number, limit: number) =>
    api
      .get<TimesheetReportResponse>('/reports/timesheets/paginated', {
        params: activeParams({ ...filters, page, limit }),
      })
      .then((res) => res.data),

  // Returns a direct download URL (opened in a new tab) rather than an async
  // call — the export endpoint streams an .xlsx file, not JSON.
  getTimesheetExportUrl: (filters: TimesheetReportFilters) => {
    const query = new URLSearchParams(activeParams({ ...filters }) as Record<string, string>).toString();
    return `${API_BASE_URL}/reports/export/timesheets-detailed?${query}`;
  },

  getDepartments: () => api.get<AttendanceDepartment[]>('/reports/meta/departments').then((res) => res.data),

  getAttendanceReport: (filters: AttendanceReportFilters) =>
    api
      .get<AttendanceReportResponse>('/reports/attendance-report', { params: activeParams({ ...filters }) })
      .then((res) => res.data),

  // Same endpoint as getAttendanceReport, with export=excel — streams a
  // multi-sheet .xlsx file, so this returns a URL to open, not JSON.
  getAttendanceExportUrl: (filters: AttendanceReportFilters) => {
    const query = new URLSearchParams(
      activeParams({ ...filters, export: 'excel' }) as Record<string, string>,
    ).toString();
    return `${API_BASE_URL}/reports/attendance-report?${query}`;
  },

  // Detailed timesheet-entries report — every filter optional; an empty
  // `filters` object returns the full, unfiltered dataset one page at a time.
  getTimesheetEntriesReport: (filters: TimesheetEntriesFilters, page: number, limit: number) =>
    api
      .get<TimesheetEntriesResponse>('/reports/timesheets/detailed/paginated', {
        params: activeParams({ ...filters, page, limit }),
      })
      .then((res) => res.data),

  // Returns a direct download URL (opened in a new tab) — the export endpoint
  // streams an .xlsx file, not JSON. Exports the currently applied filters,
  // or the full dataset when none are set.
  getTimesheetEntriesExportUrl: (filters: TimesheetEntriesFilters) => {
    const query = new URLSearchParams(activeParams({ ...filters }) as Record<string, string>).toString();
    return `${API_BASE_URL}/reports/export/timesheets-detailed?${query}`;
  },

  // Monthly Efforts Logged report — total hours per project, cumulative up to
  // an as-of date (server defaults to end of current month when omitted).
  getMonthlyEffortsReport: (filters: MonthlyEffortsFilters, page: number, limit: number) =>
    api
      .get<MonthlyEffortsResponse>('/reports/monthly-efforts', {
        params: activeParams({ ...filters, page, limit }),
      })
      .then((res) => res.data),

  getMonthlyEffortsExportUrl: (filters: MonthlyEffortsFilters) => {
    const query = new URLSearchParams(activeParams({ ...filters }) as Record<string, string>).toString();
    return `${API_BASE_URL}/reports/export/monthly-efforts?${query}`;
  },

  // Monthly Attendance Report — one row per employee per calendar day of the
  // selected month (defaults server-side to the current month when omitted).
  getMonthlyAttendanceReport: (filters: MonthlyAttendanceFilters, page: number, limit: number) =>
    api
      .get<MonthlyAttendanceResponse>('/reports/monthly-attendance', {
        params: activeParams({ ...filters, page, limit }),
      })
      .then((res) => res.data),

  getMonthlyAttendanceExportUrl: (filters: MonthlyAttendanceFilters) => {
    const query = new URLSearchParams(activeParams({ ...filters }) as Record<string, string>).toString();
    return `${API_BASE_URL}/reports/export/monthly-attendance?${query}`;
  },

  getNonComplianceReport: (filters: NonComplianceQuery, page: number, limit: number) =>
    api
      .get<NonComplianceResponse>('/reports/non-compliance', {
        params: activeParams({ ...filters, page, limit }),
      })
      .then((res) => res.data),

  getNonComplianceExportUrl: (filters: NonComplianceQuery) => {
    const query = new URLSearchParams(activeParams({ ...filters }) as Record<string, string>).toString();
    return `${API_BASE_URL}/reports/export/non-compliance?${query}`;
  },
};

export interface NonComplianceQuery {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  userName?: string;
  userId?: string;
  includeWeekends?: '' | 'true' | 'false';
  includeHolidays?: '' | 'true' | 'false';
  includePendingLeave?: '' | 'true' | 'false';
  timeZone?: string;
}

export interface NonComplianceRow {
  employeeCode: string;
  employeeName: string;
  email: string;
  department: string;
  manager: string | null;
  date: string;
  dayOfWeek: string;
  shiftStartTime: string;
}

export interface NonComplianceResponse {
  data: NonComplianceRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

