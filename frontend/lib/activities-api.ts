import api from './api';

export type ActivityStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type ActivityActionType =
  | 'CREATED' | 'POSTPONED' | 'COMPLETED' | 'CANCELLED' | 'SERIES_CANCELLED' | 'REMARK_ADDED';
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type RecurrenceStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface ActivityAssignee {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface ActivityActionEntry {
  id: string;
  type: ActivityActionType;
  remarks: string | null;
  createdAt: string;
  fromStartAt: string | null;
  fromEndAt: string | null;
  toStartAt: string | null;
  toEndAt: string | null;
  actor: { id: string; firstName: string | null; lastName: string | null };
}

export interface Activity {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdByName: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: ActivityStatus;
  postponeCount: number;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Server-formatted, human-readable window — used verbatim in lists. */
  window: string;
  assignees: ActivityAssignee[];
  actions: ActivityActionEntry[];
  canManage?: boolean;
  isCreator?: boolean;
  isAssignee?: boolean;
  /** Set when this activity was generated from a recurring series. */
  recurrenceId?: string | null;
}

export interface ActivityRecurrence {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdByName: string;
  frequency: RecurrenceFrequency;
  interval: number;
  byWeekday: number[];
  byMonthDay: number | null;
  byMonthDays?: number[];
  seriesStartAt: string;
  durationMin: number;
  allDay: boolean;
  seriesEndDate: string | null;
  maxOccurrences: number | null;
  skipNonWorkingDays: boolean;
  status: RecurrenceStatus;
  occurrenceCount: number;
  createdAt: string;
  /** Server-rendered plain-language rule, e.g. "Every week on Mon, Wed, 09:00 AM". */
  summary: string;
  pendingCount: number;
  completedCount: number;
  nextOccurrenceAt: string | null;
  assignees: ActivityAssignee[];
  canManage?: boolean;
}

export interface PaginatedRecurrences {
  data: ActivityRecurrence[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ActivityAssigneeOption {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isSelf: boolean;
}

export interface PaginatedActivities {
  data: Activity[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type ActivityQueryParams = {
  status?: ActivityStatus;
  search?: string;
  /** YYYY-MM-DD — keeps activities whose window overlaps this date onward. */
  from?: string;
  /** YYYY-MM-DD — keeps activities whose window starts on or before this date. */
  to?: string;
  page?: number;
  limit?: number;
};

export interface CreateActivityPayload {
  name: string;
  description?: string;
  assigneeIds?: string[];
  startAt: string;
  endAt: string;
  allDay?: boolean;
}

export interface CreateRecurringActivityPayload {
  name: string;
  description?: string;
  assigneeIds?: string[];
  /** The FIRST occurrence's window — its time and duration repeat. */
  startAt: string;
  endAt: string;
  allDay?: boolean;
  frequency: RecurrenceFrequency;
  interval?: number;
  /** WEEKLY only — 0=Sun … 6=Sat. */
  byWeekday?: number[];
  /** MONTHLY only — 1–31, clamped in shorter months. */
  byMonthDay?: number;
  /** MONTHLY only — array of days (1–31). */
  byMonthDays?: number[];
  /** YYYY-MM-DD. Omit together with maxOccurrences to repeat indefinitely. */
  seriesEndDate?: string;
  maxOccurrences?: number;
  /** Drop occurrences on Sat/Sun or a non-optional public holiday. */
  skipNonWorkingDays?: boolean;
}

export interface PostponeActivityPayload {
  startAt: string;
  endAt: string;
  allDay?: boolean;
  remarks?: string;
}

export interface UpdateActivityPayload {
  name?: string;
  description?: string;
  assigneeIds?: string[];
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}

export const activitiesApi = {
  getMine: (params?: ActivityQueryParams) =>
    api.get<PaginatedActivities>('/activities/mine', { params }).then((res) => res.data),

  getAssigned: (params?: ActivityQueryParams) =>
    api.get<PaginatedActivities>('/activities/assigned', { params }).then((res) => res.data),

  getAssigneeOptions: () =>
    api.get<ActivityAssigneeOption[]>('/activities/assignee-options').then((res) => res.data),

  getActivity: (id: string) =>
    api.get<Activity>(`/activities/${id}`).then((res) => res.data),

  createActivity: (payload: CreateActivityPayload) =>
    api.post<Activity>('/activities', payload).then((res) => res.data),

  updateActivity: (id: string, payload: UpdateActivityPayload) =>
    api.patch<Activity>(`/activities/${id}`, payload).then((res) => res.data),

  postponeActivity: (id: string, payload: PostponeActivityPayload) =>
    api.patch<Activity>(`/activities/${id}/postpone`, payload).then((res) => res.data),

  completeActivity: (id: string, remarks?: string) =>
    api.patch<Activity>(`/activities/${id}/complete`, { remarks }).then((res) => res.data),

  cancelActivity: (id: string, remarks?: string) =>
    api.patch<Activity>(`/activities/${id}/cancel`, { remarks }).then((res) => res.data),

  updateStatus: (id: string, payload: { status: ActivityStatus; remarks?: string }) =>
    api.patch<Activity>(`/activities/${id}/status`, payload).then((res) => res.data),

  /** Remarks-only update — no status change. What an assignee (non-creator) may do. */
  addRemark: (id: string, remarks: string) =>
    api.patch<Activity>(`/activities/${id}/remark`, { remarks }).then((res) => res.data),

  // ── Recurring series ──────────────────────────────────────────────────────

  getRecurrences: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedRecurrences>('/activities/recurring', { params }).then((res) => res.data),

  getRecurrence: (id: string) =>
    api.get<ActivityRecurrence>(`/activities/recurring/${id}`).then((res) => res.data),

  createRecurringActivity: (payload: CreateRecurringActivityPayload) =>
    api.post<ActivityRecurrence>('/activities/recurring', payload).then((res) => res.data),

  cancelRecurrence: (id: string, remarks?: string) =>
    api
      .patch<ActivityRecurrence>(`/activities/recurring/${id}/cancel`, { remarks })
      .then((res) => res.data),
};
