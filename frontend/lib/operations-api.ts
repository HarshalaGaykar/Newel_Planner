import api from './api';

// Timesheet Types
export enum TimesheetStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  RA_APPROVED = 'RA_APPROVED',
  TL_APPROVED = 'TL_APPROVED',
  PM_APPROVED = 'PM_APPROVED',
  REJECTED = 'REJECTED',
}

export enum TimesheetTaskType {
  OBSERVATION = 'OBSERVATION',
  CHANGE_REQUEST = 'CHANGE_REQUEST',
}

export interface Timesheet {
  id: string;
  userId: string;
  projectId: string | null;
  startDate: string;
  endDate: string;
  status: TimesheetStatus;
  approverId: string | null;
  lastStatusChange: string;
  rejectionRemarks?: string | null;
  createdAt: string;
  updatedAt: string;
  entries?: TimesheetEntry[];
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl?: string | null;
    reportingAuthorityId?: string | null;
  };
  dailyTotals?: Record<string, number>;
}

export interface TimesheetEntry {
  id: string;
  timesheetId: string;
  projectId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  hours: number;
  description: string | null;
  taskType: TimesheetTaskType;
  activityMasterId: string | null;
  taskSubActivityMasterId: string | null;
  taskId: string | null;
  ticketId: string | null;
  project?: { id: string; name: string };
  activityMaster?: { activity: string; subActivity: string; taskType: string } | null;
  taskSubActivity?: {
    id: string;
    name: string;
    description: string | null;
    activity: {
      id: string;
      name: string;
      taskType: { id: string; name: string };
    };
  } | null;
  task?: {
    id: string;
    title: string;
    parentId?: string | null;
    parent?: { id: string; title: string } | null;
  } | null;
  /**
   * Soft over-estimate warning returned when this entry is saved (add or update).
   * Never blocks the save — the entry is always written. Present only on the
   * response, not on entries read back from a timesheet.
   */
  effortWarning?: string | null;
}

/**
 * Estimate vs logged hours for a task, as the server sees it: the estimate is
 * `plannedHours ?? estimatedEffort` (the same rule the TL dashboard Gantt badges
 * with) and `loggedHours` sums every entry against the task across all timesheets.
 */
export interface TaskEffortStatus {
  taskId: string;
  applicable: boolean;
  withinEstimate: 'WITHIN' | 'OVER' | 'UNESTIMATED';
  estimateHours: number | null;
  loggedHours: number;
  projectedHours: number;
  overByHours: number;
  remainingHours: number | null;
  warning: string | null;
}

export interface TimesheetActivityMaster {
  id: string;
  taskType: TimesheetTaskType;
  activity: string;
  subActivity: string;
  meaning: string | null;
}

export type CreateTimesheetEntryPayload = {
  projectId: string;
  date: string;
  hours: number;
  taskId?: string;
  ticketId?: string;
  taskType?: TimesheetTaskType;
  activity?: string;
  subActivity?: string;
  activityMasterId?: string;
  taskSubActivityMasterId?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  timeZone?: string;
};

export type TimesheetQueryParams = {
  userId?: string;
  projectId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

export interface TeamTimesheetSummary {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  latestWeekStart: string | null;
  latestWeekEnd: string | null;
  latestStatus: TimesheetStatus | null;
  latestWeekHours: number;
  monthHours: number;
  pendingTimesheets: number;
  approvedTimesheets: number;
  rejectedTimesheets: number;
}

export type TeamSummaryQueryParams = {
  userId?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedTeamTimesheetSummary {
  data: TeamTimesheetSummary[];
  meta: PaginationMeta;
}

export interface TeamSummaryOption {
  userId: string;
  name: string;
  email: string;
}

export interface CalendarEntryActivity {
  type: string;
  activity: string;
  subActivity: string;
}

export interface CalendarEntry {
  id: string;
  timesheetId: string;
  status: TimesheetStatus;
  hours: number;
  description: string | null;
  projectId: string;
  projectName: string | null;
  taskName: string | null;
  taskType: string;
  activity: CalendarEntryActivity | null;
}

export interface CalendarDay {
  date: string;
  hours: number;
  entries: CalendarEntry[];
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isLeave: boolean;
  /** False for weekends, public holidays and full-day leave. */
  isWorkingDay: boolean;
  /** A working day logging fewer than `minDailyHours`. */
  isShortfall: boolean;
}

export interface TimesheetCalendarMonth {
  userId: string;
  month: string;
  monthStart: string;
  monthEnd: string;
  /** Admin-configured shortfall threshold (timesheet.min_daily_hours). */
  minDailyHours: number;
  totalHours: number;
  /** Count of days that actually have entries — `days` now covers the whole month. */
  daysLogged: number;
  days: CalendarDay[];
}

export interface TimesheetSettings {
  backdatedDaysLimit: number;
  minDailyHours: number;
}

export interface TimesheetBulkUploadReport {
  batchId: string;
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
  /** Rows that imported fine but took the task over its estimate (soft warnings). */
  warnings?: { row: number; message: string }[];
}

export interface TimesheetBulkUpload {
  id: string;
  fileName: string | null;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  status: 'COMPLETED' | 'ROLLED_BACK';
  createdAt: string;
  rolledBackAt: string | null;
}

export interface TimesheetBulkUploadHistoryResponse {
  data: TimesheetBulkUpload[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TimesheetBulkUploadErrorsResponse {
  batchId: string;
  errors: { row: number; message: string }[];
}

export interface MissingEntryUser {
  userId: string;
  name: string;
  email: string;
  department: string | null;
  missingDates: string[]; // 'YYYY-MM-DD'
  totalMissing: number;
}

// Leave Types
export interface LeaveTypeMaster {
  id: string;
  code: string;
  name: string;
  isPaid: boolean;
  allowHalfDay: boolean;
  carryForwardMax: number;
  expiryMonths: number | null;
  requiresApproval: boolean;
  requiresSandwichCheck: boolean;
  isActive: boolean;
}

export interface Leave {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  leaveTypeCode: string;
  isHalfDay: boolean;
  halfDaySession: string | null;
  sandwichDays: number;
  duration: number;
  pmStatus: string;
  hrStatus: string;
  raStatus: string;
  status: string;
  reason: string | null;
  approvalStep?: 'RA' | 'PM' | 'HR';
  user?: {
    id?: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    reportingAuthorityId?: string | null;
  };
}

export interface LeaveBalance {
  id: string;
  userId: string;
  leaveTypeCode: string;
  type: string;
  isPaid: boolean;
  earned: number;
  used: number;
  carryForward: number;
  available: number;
  expiryDate: string | null;
  financialYearId: string | null;
}

export interface AdminUserBalance {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string | null;
  balances: {
    leaveTypeCode: string;
    earned: number;
    used: number;
    carryForward: number;
    available: number;
  }[];
}

export interface LeaveCalendarEntry {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  leaveTypeCode: string;
  status: string;
  duration: number;
  isHalfDay: boolean;
  user: { firstName: string; lastName: string };
}

export interface Attendance {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  checkInTimeZone: string | null;
  checkOut: string | null;
  checkOutTimeZone: string | null;
  status: string;
  remarks: string | null;
  isWfh: boolean;
  overtimeHours: number;
  shiftId: string | null;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
  };
}

export enum RegularizationReason {
  FORGOT_PUNCH = 'FORGOT_PUNCH',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  FIELD_WORK = 'FIELD_WORK',
  CLIENT_VISIT = 'CLIENT_VISIT',
  TRAINING = 'TRAINING',
  OTHER = 'OTHER',
}

export enum RegularizationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface AttendanceRegularization {
  id: string;
  userId: string;
  attendanceId: string | null;
  date: string;
  requestedIn: string | null;
  requestedInTimeZone: string | null;
  requestedOut: string | null;
  requestedOutTimeZone: string | null;
  reason: RegularizationReason;
  remarks: string | null;
  status: RegularizationStatus;
  approverId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
  };
  approver?: {
    firstName: string;
    lastName: string;
  } | null;
}

export interface CompOff {
  id: string;
  userId: string;
  date: string;
  hoursWorked: number;
  extraHours: number;
  status: string;
  user?: {
    id?: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    reportingAuthorityId?: string | null;
  };
}

type AttendanceQueryParams = {
  startDate?: string;
  endDate?: string;
  userId?: string;
  timeZone?: string;
};

type CreateCompOffPayload = {
  userId: string;
  date: string;
  hoursWorked: number;
};

export interface PublicHoliday {
  id: string;
  name: string;
  date: string;
  type: string;
  description?: string | null;
  isGlobal?: boolean;
  isOptional?: boolean;
}

// Operations API
export const operationsApi = {
  // Timesheets
  getTimesheets: (paramsOrUserId?: TimesheetQueryParams | string, projectId?: string, status?: string) => {
    const params =
      typeof paramsOrUserId === 'string' || paramsOrUserId === undefined
        ? { userId: paramsOrUserId, projectId, status }
        : paramsOrUserId;

    return api.get<Timesheet[]>('/timesheets', { params }).then((res) => res.data);
  },
  getTeamTimesheetSummary: (params?: TeamSummaryQueryParams) =>
    api
      .get<PaginatedTeamTimesheetSummary>('/timesheets/team-summary', { params })
      .then((res) => res.data),
  getTeamSummaryOptions: () =>
    api.get<TeamSummaryOption[]>('/timesheets/team-summary/options').then((res) => res.data),
  getTimesheetCalendar: (params?: { month?: string; userId?: string }) =>
    api
      .get<TimesheetCalendarMonth>('/timesheets/calendar', { params })
      .then((res) => res.data),

  // Bulk fill — download a per-user template, then upload the filled sheet.
  downloadTimesheetTemplate: () =>
    api.get('/timesheets/bulk-template', { responseType: 'blob' }).then((res) => res.data as Blob),
  // Estimate vs logged hours for one task, for the entry form's over-run warning.
  // `incomingHours` projects the entry being typed; `excludeEntryId` keeps the
  // entry being edited out of the logged total.
  getTaskEffortStatus: (
    taskId: string,
    params?: { incomingHours?: number; excludeEntryId?: string },
  ) =>
    api
      .get<TaskEffortStatus>(`/timesheets/tasks/${taskId}/effort-status`, { params })
      .then((res) => res.data),

  bulkUploadTimesheet: (file: File, timeZone?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (timeZone) form.append('timeZone', timeZone);
    return api
      .post<TimesheetBulkUploadReport>('/timesheets/bulk-upload', form)
      .then((res) => res.data);
  },
  listTimesheetUploads: () =>
    api.get<TimesheetBulkUpload[]>('/timesheets/bulk-uploads').then((res) => res.data),
  listTimesheetUploadHistory: (page: number, pageSize: number) =>
    api
      .get<TimesheetBulkUploadHistoryResponse>('/timesheets/bulk-upload-history', { params: { page, pageSize } })
      .then((res) => res.data),
  getTimesheetUploadErrors: (batchId: string) =>
    api
      .get<TimesheetBulkUploadErrorsResponse>(`/timesheets/bulk-upload/${batchId}/errors`)
      .then((res) => res.data),
  rollbackTimesheetUpload: (batchId: string) =>
    api
      .post<{ deletedEntries: number; deletedTimesheets: number }>(`/timesheets/bulk-upload/${batchId}/rollback`)
      .then((res) => res.data),
  getTimesheetSettings: () =>
    api.get<TimesheetSettings>('/timesheets/settings').then((res) => res.data),
  getMissingEntries: (params: { from: string; to: string; userId?: string; departmentId?: string }) =>
    api.get<MissingEntryUser[]>('/timesheets/missing-entries', { params }).then((res) => res.data),
  getTimesheet: (id: string) => api.get<Timesheet>(`/timesheets/${id}`).then((res) => res.data),
  getOrCreateWeekly: (data: { userId: string; startDate: string; endDate: string }) =>
    api.post<Timesheet>('/timesheets/weekly', data).then((res) => res.data),
  
  // Entries
  addEntry: (timesheetId: string, data: CreateTimesheetEntryPayload) =>
    api.post<TimesheetEntry>(`/timesheets/${timesheetId}/entry`, data).then((res) => res.data),
  updateEntry: (entryId: string, data: Partial<CreateTimesheetEntryPayload>) =>
    api.patch<TimesheetEntry>(`/timesheets/entry/${entryId}`, data).then((res) => res.data),
  removeEntry: (entryId: string) => api.delete(`/timesheets/entry/${entryId}`).then((res) => res.data),

  // Workflow
  submitTimesheet: (timesheetId: string) => api.patch(`/timesheets/${timesheetId}/submit`).then((res) => res.data),
  approveTimesheetRA: (timesheetId: string) => api.patch(`/timesheets/${timesheetId}/approve-ra`).then((res) => res.data),
  approveTimesheetTL: (timesheetId: string) => api.patch(`/timesheets/${timesheetId}/approve-ra`).then((res) => res.data),
  approveTimesheetPM: (timesheetId: string) => api.patch(`/timesheets/${timesheetId}/approve-pm`).then((res) => res.data),
  rejectTimesheet: (timesheetId: string, remarks: string) =>
    api.patch(`/timesheets/${timesheetId}/reject`, { remarks }).then((res) => res.data),
  
  // Master Data
  getActivityMaster: (taskType?: string) => 
    api.get<TimesheetActivityMaster[]>('/timesheets/activity-master', { params: { taskType } }).then((res) => res.data),

  // Leaves
  getLeaves: (userId?: string) => api.get<Leave[]>('/leaves', { params: { userId } }).then((res) => res.data),
  getPendingLeaveApprovals: () => api.get<Leave[]>('/leaves/pending-approvals').then((res) => res.data),
  getLeaveBalances: (userId: string) => api.get<LeaveBalance[]>('/leaves/balance', { params: { userId } }).then((res) => res.data),
  getLeaveCalendar: (month: number, year: number, departmentId?: string) =>
    api.get<LeaveCalendarEntry[]>('/leaves/calendar', { params: { month, year, departmentId } }).then((res) => res.data),
  applyLeave: (data: Partial<Leave> & { userId: string; leaveTypeCode: string; startDate: string; endDate: string }) =>
    api.post<Leave>('/leaves', data).then((res) => res.data),
  approveLeaveRA: (leaveId: string) => api.patch(`/leaves/${leaveId}/ra-approve`).then((res) => res.data),
  approveLeavePM: (leaveId: string) => api.patch(`/leaves/${leaveId}/pm-approve`).then((res) => res.data),
  approveLeaveHR: (leaveId: string) => api.patch(`/leaves/${leaveId}/hr-approve`).then((res) => res.data),
  rejectLeave: (leaveId: string) => api.patch(`/leaves/${leaveId}/reject`).then((res) => res.data),
  deleteLeave: (leaveId: string) => api.delete(`/leaves/${leaveId}`).then((res) => res.data),
  exportLeaves: async () => {
    const res = await api.get('/leaves/export/my-leaves', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'my-leaves-export.xlsx');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  // Leave Type Master
  getLeaveTypes: () => api.get<LeaveTypeMaster[]>('/leave-type-masters').then((res) => res.data),

  // Admin Leave Balance Management
  getAdminAllBalances: () =>
    api.get<{ leaveTypes: { code: string; name: string; isPaid: boolean }[]; users: AdminUserBalance[] }>('/leaves/admin/all-balances').then((res) => res.data),
  updateLeaveBalance: (userId: string, leaveTypeCode: string, earnedBalance: number, carryForward?: number) =>
    api.patch('/leaves/admin/balance', { userId, leaveTypeCode, earnedBalance, carryForward }).then((res) => res.data),
  bulkUpdateLeaveBalances: (updates: { email: string; leaveTypeCode: string; earnedBalance: number }[]) =>
    api.post<{ updated: number; errors: string[] }>('/leaves/admin/bulk-update', { updates }).then((res) => res.data),
  initLeaveBalances: (defaults: Record<string, number>, userId?: string) =>
    api.post<{ created: number; usersProcessed: number }>('/leaves/admin/init-balances', { defaults, userId }).then((res) => res.data),

  // Attendance
  getTodayAttendance: (timeZone?: string) => api.get<Attendance>('/attendance/today', { params: { timeZone } }).then((res) => res.data),
  checkIn: (data: { remarks?: string; isWfh?: boolean; timeZone?: string }) => api.post<Attendance>('/attendance/check-in', data).then((res) => res.data),
  checkOut: (data: { remarks?: string; timeZone?: string }) => api.post<Attendance>('/attendance/check-out', data).then((res) => res.data),
  getMyAttendance: (params?: AttendanceQueryParams) => api.get<Attendance[]>('/attendance/my', { params }).then((res) => res.data),
  getTeamAttendance: (params?: AttendanceQueryParams) => api.get<Attendance[]>('/attendance/team', { params }).then((res) => res.data),
  getDailySummary: (date: string, timeZone?: string) => api.get<{ attendance: Attendance | null; regularization: AttendanceRegularization | null }>('/attendance/summary', { params: { date, timeZone } }).then((res) => res.data),
  // Attendance Regularization
  createRegularization: (data: { date: string; attendanceId?: string; requestedIn?: string; requestedOut?: string; reason: RegularizationReason; remarks?: string; timeZone?: string }) =>
    api.post<AttendanceRegularization>('/attendance/regularize', data).then((res) => res.data),
  getMyRegularizations: (params?: AttendanceQueryParams) => api.get<AttendanceRegularization[]>('/attendance/regularize', { params }).then((res) => res.data),
  getPendingRegularizations: (params?: AttendanceQueryParams) => api.get<AttendanceRegularization[]>('/attendance/regularize/pending', { params }).then((res) => res.data),
  approveRegularization: (id: string) => api.patch<AttendanceRegularization>(`/attendance/regularize/${id}/approve`).then((res) => res.data),
  rejectRegularization: (id: string) => api.patch<AttendanceRegularization>(`/attendance/regularize/${id}/reject`).then((res) => res.data),

  // Comp-Off
  getCompOffs: (userId?: string) => api.get<CompOff[]>('/comp-off', { params: { userId } }).then((res) => res.data),
  createCompOff: (data: CreateCompOffPayload) => api.post<CompOff>('/comp-off', data).then((res) => res.data),
  approveCompOff: (id: string) => api.patch(`/comp-off/${id}/approve`).then((res) => res.data),
  rejectCompOff: (id: string) => api.patch(`/comp-off/${id}/reject`).then((res) => res.data),
  utiliseCompOff: (id: string) => api.patch(`/comp-off/${id}/utilise`).then((res) => res.data),
  deleteCompOff: (id: string) => api.delete(`/comp-off/${id}`).then((res) => res.data),

  // Public Holidays
  getHolidays: (year: number) => api.get<PublicHoliday[]>('/public-holidays', { params: { year } }).then((res) => res.data),
};
