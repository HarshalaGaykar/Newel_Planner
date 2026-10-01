'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Inbox, ListChecks, Plus, Repeat,
  UserRound, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/lib/store/auth';
import {
  activitiesApi, Activity, ActivityRecurrence, ActivityStatus, PaginatedActivities,
  PaginatedRecurrences,
} from '@/lib/activities-api';
import TaskList from '@/components/todo/TaskList';
import NewActivityDialog from '@/components/todo/NewActivityDialog';
import PostponeActivityDialog from '@/components/todo/PostponeActivityDialog';
import RecurrenceList from '@/components/todo/RecurrenceList';
import CancelSeriesDialog from '@/components/todo/CancelSeriesDialog';
import EditActivityDialog from '@/components/todo/EditActivityDialog';
import TodoCalendar from '@/components/todo/TodoCalendar';
import ActivityDetailDialog from '@/components/todo/ActivityDetailDialog';
import UpdateStatusDialog from '@/components/todo/UpdateStatusDialog';
import {
  DEFAULT_PERIOD, PERIOD_OPTIONS, TodoPeriod, describePeriod, resolvePeriod,
} from '@/lib/todo-period';

// Grouping by urgency only says something when a useful slice of the list is on
// screen, so the page is as large as the API allows short of its 100 cap.
const PAGE_SIZE = 50;

// Series are tall cards rather than rows, so a short page keeps the list from
// running past the fold.
const SERIES_PAGE_SIZE = 5;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ALL', label: 'All statuses' },
];

// Default to All: every period tab starts unfiltered by status, so switching
// tabs never quietly hides completed/cancelled activities.
const DEFAULT_STATUS = 'ALL';

type TodoView = 'mine' | 'assigned' | 'calendar' | 'recurring';

const VIEWS: { value: TodoView; label: string; icon: typeof UserRound }[] = [
  { value: 'mine', label: 'My Activities', icon: UserRound },
  { value: 'assigned', label: 'Assigned To Me', icon: Inbox },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'recurring', label: 'Recurring', icon: Repeat },
];

const DATE_FILTER_CLASS =
  'w-full h-9 rounded-md border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring';

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

const EMPTY: PaginatedActivities = {
  data: [],
  meta: { total: 0, page: 1, limit: PAGE_SIZE, totalPages: 0 },
};

const EMPTY_SERIES: PaginatedRecurrences = {
  data: [],
  meta: { total: 0, page: 1, limit: SERIES_PAGE_SIZE, totalPages: 0 },
};

export default function TodoListPage() {
  const { user } = useAuthStore();

  const [view, setView] = useState<TodoView>('mine');
  const [mine, setMine] = useState<PaginatedActivities>(EMPTY);
  const [assigned, setAssigned] = useState<PaginatedActivities>(EMPTY);
  const [mineLoading, setMineLoading] = useState(true);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [error, setError] = useState('');

  const [minePage, setMinePage] = useState(1);
  const [assignedPage, setAssignedPage] = useState(1);
  const [mineStatus, setMineStatus] = useState(DEFAULT_STATUS);
  const [assignedStatus, setAssignedStatus] = useState(DEFAULT_STATUS);
  const [minePeriod, setMinePeriod] = useState<TodoPeriod>(DEFAULT_PERIOD);
  const [assignedPeriod, setAssignedPeriod] = useState<TodoPeriod>(DEFAULT_PERIOD);
  const [mineCustom, setMineCustom] = useState({ from: '', to: '' });
  const [assignedCustom, setAssignedCustom] = useState({ from: '', to: '' });

  const [series, setSeries] = useState<PaginatedRecurrences>(EMPTY_SERIES);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesPage, setSeriesPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Activity | null>(null);
  const [postponeTarget, setPostponeTarget] = useState<Activity | null>(null);
  const [cancelSeriesTarget, setCancelSeriesTarget] = useState<ActivityRecurrence | null>(null);
  const [detailTarget, setDetailTarget] = useState<Activity | null>(null);
  const [statusTarget, setStatusTarget] = useState<Activity | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const asStatus = (value: string) => (value === 'ALL' ? undefined : (value as ActivityStatus));

  const fetchMine = useCallback(async () => {
    try {
      setMineLoading(true);
      setError('');
      setMine(await activitiesApi.getMine({
        page: minePage,
        limit: PAGE_SIZE,
        status: asStatus(mineStatus),
        ...resolvePeriod(minePeriod, mineCustom),
      }));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load your activities'));
    } finally {
      setMineLoading(false);
    }
  }, [minePage, mineStatus, minePeriod, mineCustom]);

  const fetchAssigned = useCallback(async () => {
    try {
      setAssignedLoading(true);
      setAssigned(await activitiesApi.getAssigned({
        page: assignedPage,
        limit: PAGE_SIZE,
        status: asStatus(assignedStatus),
        ...resolvePeriod(assignedPeriod, assignedCustom),
      }));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load assigned activities'));
    } finally {
      setAssignedLoading(false);
    }
  }, [assignedPage, assignedStatus, assignedPeriod, assignedCustom]);

  const fetchSeries = useCallback(async () => {
    try {
      setSeriesLoading(true);
      setSeries(await activitiesApi.getRecurrences({ page: seriesPage, limit: SERIES_PAGE_SIZE }));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load recurring activities'));
    } finally {
      setSeriesLoading(false);
    }
  }, [seriesPage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void fetchMine(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchMine]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void fetchSeries(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchSeries]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void fetchAssigned(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAssigned]);

  // Any action can change which page an item belongs to, so every list refreshes
  // — stopping a series also bulk-cancels occurrences in the other two tabs.
  const refreshAll = useCallback(() => {
    void fetchMine();
    void fetchAssigned();
    void fetchSeries();
  }, [fetchMine, fetchAssigned, fetchSeries]);

  const runAction = async (
    activity: Activity,
    action: (id: string) => Promise<unknown>,
    successMessage: string,
  ) => {
    try {
      setBusyId(activity.id);
      await action(activity.id);
      toast.success(successMessage);
      refreshAll();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  // With the Pending default the server total *is* the pending count; under any
  // other filter fall back to counting the loaded page rather than mislabel it.
  const pendingCount = useMemo(
    () =>
      assignedStatus === 'PENDING'
        ? assigned.meta.total
        : assigned.data.filter((a) => a.status === 'PENDING').length,
    [assignedStatus, assigned.meta.total, assigned.data],
  );

  const renderFilterBar = (filters: {
    status: string;
    period: TodoPeriod;
    custom: { from: string; to: string };
    total: number;
    onStatus: (next: string) => void;
    onPeriod: (next: TodoPeriod) => void;
    onCustom: (next: { from: string; to: string }) => void;
    onClear: () => void;
  }) => {
    const dirty = filters.status !== DEFAULT_STATUS || filters.period !== DEFAULT_PERIOD;

    return (
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        {/* Period first and as one-tap buttons: picking a range was the step that
            needed two date fields and prior knowledge of what was in them. */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Show
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {PERIOD_OPTIONS.map((option) => {
              const active = filters.period === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => filters.onPeriod(option.value)}
                  aria-pressed={active}
                  className={`h-8 rounded-md border px-3 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5 sm:w-44">
            <Label className="text-xs font-medium text-muted-foreground">
              Status
            </Label>
            <Select value={filters.status} onValueChange={filters.onStatus}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* The raw date fields now appear only when they are the point. */}
          {filters.period === 'CUSTOM' && (
            <>
              <div className="space-y-1.5 sm:w-40">
                <Label className="text-xs font-medium text-muted-foreground">
                  From Date
                </Label>
                <input
                  type="date"
                  value={filters.custom.from}
                  onChange={(e) => filters.onCustom({ ...filters.custom, from: e.target.value })}
                  className={DATE_FILTER_CLASS}
                />
              </div>

              <div className="space-y-1.5 sm:w-40">
                <Label className="text-xs font-medium text-muted-foreground">
                  To Date
                </Label>
                <input
                  type="date"
                  value={filters.custom.to}
                  min={filters.custom.from || undefined}
                  onChange={(e) => filters.onCustom({ ...filters.custom, to: e.target.value })}
                  className={DATE_FILTER_CLASS}
                />
              </div>
            </>
          )}

          {dirty && (
            <Button
              variant="outline"
              onClick={filters.onClear}
              className="h-9 gap-1.5 px-2.5 text-sm font-semibold"
            >
              <X size={14} />
              Reset
            </Button>
          )}

          {/* Spells out the active range — a bare count next to a set of pills
              leaves you guessing which slice you are actually looking at. */}
          <span className="text-sm text-muted-foreground sm:ml-auto sm:pb-2">
            <span className="font-semibold text-foreground">{filters.total}</span>
            {' '}activit{filters.total === 1 ? 'y' : 'ies'}
            {' · '}
            {describePeriod(filters.period, filters.custom)}
          </span>
        </div>
      </div>
    );
  };

  const renderPager = (
    page: number,
    totalPages: number,
    total: number,
    setPage: (next: number) => void,
    pageSize = PAGE_SIZE,
  ) => {
    if (totalPages <= 1) return null;

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
      <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          Showing {from}–{to} of {total}
        </span>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs font-semibold text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8 animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ListChecks className="text-primary" size={20} />
            Todo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal activities for you and your team.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus size={15} />
          New Activity
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm font-medium text-destructive">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Rail instead of tabs: the four surfaces are places you go, not layers
          stacked on one page, and the rail leaves the content its full width. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          aria-label="Todo views"
          className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:w-52 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {VIEWS.map(({ value, label, icon: Icon }) => {
            const active = view === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors lg:w-full ${
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
                {value === 'assigned' && pendingCount > 0 && (
                  <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
        {view === 'mine' && (
          <>
          {renderFilterBar({
            status: mineStatus,
            period: minePeriod,
            custom: mineCustom,
            total: mine.meta.total,
            onStatus: (next) => { setMineStatus(next); setMinePage(1); },
            onPeriod: (next) => { setMinePeriod(next); setMinePage(1); },
            onCustom: (next) => { setMineCustom(next); setMinePage(1); },
            onClear: () => {
              setMineStatus(DEFAULT_STATUS);
              setMinePeriod(DEFAULT_PERIOD);
              setMineCustom({ from: '', to: '' });
              setMinePage(1);
            },
          })}
          <TaskList
            activities={mine.data}
            loading={mineLoading}
            actionable
            busyId={busyId}
            emptyHint="Create an activity to start tracking your personal to-dos."
            onEdit={setEditTarget}
            onPostpone={setPostponeTarget}
            onComplete={(activity) =>
              runAction(activity, (id) => activitiesApi.completeActivity(id), 'Activity completed')
            }
            onCancel={(activity) =>
              runAction(activity, (id) => activitiesApi.cancelActivity(id), 'Activity cancelled')
            }
            onViewDetails={setDetailTarget}
            onUpdateStatus={setStatusTarget}
          />
          {renderPager(mine.meta.page, mine.meta.totalPages, mine.meta.total, setMinePage)}
          </>
        )}

        {view === 'assigned' && (
          <>
          {renderFilterBar({
            status: assignedStatus,
            period: assignedPeriod,
            custom: assignedCustom,
            total: assigned.meta.total,
            onStatus: (next) => { setAssignedStatus(next); setAssignedPage(1); },
            onPeriod: (next) => { setAssignedPeriod(next); setAssignedPage(1); },
            onCustom: (next) => { setAssignedCustom(next); setAssignedPage(1); },
            onClear: () => {
              setAssignedStatus(DEFAULT_STATUS);
              setAssignedPeriod(DEFAULT_PERIOD);
              setAssignedCustom({ from: '', to: '' });
              setAssignedPage(1);
            },
          })}
          <p className="text-[11px] text-muted-foreground">
            Assigned to you — you can view details and add remarks. Only the creator can change status.
          </p>
          <TaskList
            activities={assigned.data}
            loading={assignedLoading}
            actionable={false}
            emptyHint="Activities other people assign to you will appear here."
            onViewDetails={setDetailTarget}
            onUpdateStatus={setStatusTarget}
          />
          {renderPager(assigned.meta.page, assigned.meta.totalPages, assigned.meta.total, setAssignedPage)}
          </>
        )}

        {/* Mounted only while active so a month is fetched on demand, not on
            every visit to the page. */}
        {view === 'calendar' && <TodoCalendar />}

        {view === 'recurring' && (
          <>
          <p className="text-xs text-muted-foreground">
            Daily, weekly and monthly rules you created. Each one generates individual activities in
            the other views — complete or postpone those one at a time.
          </p>
          <RecurrenceList
            series={series.data}
            loading={seriesLoading}
            busyId={busyId}
            onCancel={setCancelSeriesTarget}
          />
          {renderPager(
            series.meta.page, series.meta.totalPages, series.meta.total,
            setSeriesPage, SERIES_PAGE_SIZE,
          )}
          </>
        )}
        </div>
      </div>

      {/* Mounted only while shown so each open starts from a clean form. */}
      {createOpen && (
        <NewActivityDialog
          open
          currentUserId={user?.id}
          onClose={() => setCreateOpen(false)}
          onCreated={refreshAll}
        />
      )}

      {editTarget && (
        <EditActivityDialog
          open
          activity={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={refreshAll}
        />
      )}

      {postponeTarget && (
        <PostponeActivityDialog
          activity={postponeTarget}
          onClose={() => setPostponeTarget(null)}
          onPostponed={refreshAll}
        />
      )}

      {cancelSeriesTarget && (
        <CancelSeriesDialog
          series={cancelSeriesTarget}
          onClose={() => setCancelSeriesTarget(null)}
          onCancelled={refreshAll}
        />
      )}

      {detailTarget && (
        <ActivityDetailDialog
          open
          activity={detailTarget}
          onClose={() => setDetailTarget(null)}
          onUpdateStatusClick={(act) => {
            setDetailTarget(null);
            setStatusTarget(act);
          }}
        />
      )}

      {statusTarget && (
        <UpdateStatusDialog
          open
          activity={statusTarget}
          onClose={() => setStatusTarget(null)}
          onUpdated={refreshAll}
        />
      )}
    </div>
  );
}
