'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Repeat,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { activitiesApi, Activity, ActivityStatus } from '@/lib/activities-api';
import { toDateInput } from '@/lib/todo-period';
import { useAuthStore } from '@/lib/store/auth';
import TaskRow from './TaskRow';

import ActivityDetailDialog from './ActivityDetailDialog';
import UpdateStatusDialog from './UpdateStatusDialog';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The API caps a page at 100; a month past that is truncated, so we say so. */
const MONTH_FETCH_LIMIT = 100;

type CalendarScope = 'mine' | 'assigned' | 'all';

const CHIP_STYLES: Record<ActivityStatus, string> = {
  PENDING: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  CANCELLED: 'bg-red-100 text-red-800 line-through dark:bg-red-950/60 dark:text-red-200',
};

const DOT_STYLES: Record<ActivityStatus, string> = {
  PENDING: 'bg-blue-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

/** Whole weeks covering the month, so the grid is always a clean 7-column block. */
function buildCalendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));

  const days: Date[] = [];
  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    days.push(new Date(day));
  }
  return days;
}

/** Activities are windows, not points — a multi-day one belongs to every day it covers. */
function coversDay(activity: Activity, dayKey: string) {
  return toDateInput(new Date(activity.startAt)) <= dayKey
    && toDateInput(new Date(activity.endAt)) >= dayKey;
}

export default function TodoCalendar() {
  const { user } = useAuthStore();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // Default to "Assigned by me" ('mine') as requested
  const [scope, setScope] = useState<CalendarScope>('all');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState(() => toDateInput(new Date()));
  const [dayOpen, setDayOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Activity | null>(null);
  const [statusTarget, setStatusTarget] = useState<Activity | null>(null);

  const todayKey = toDateInput(new Date());
  const days = useMemo(() => buildCalendarDays(month), [month]);

  // "Assigned by me" is self-assigned only — created by the user AND assigned
  // to themselves. getMine returns everything the user created (including
  // activities handed off entirely to someone else), so that's narrowed here
  // rather than on the server, which still needs the broader set for the
  // main Todo list's "My Activities" tab.
  const selfAssignedOnly = useCallback(
    (items: Activity[]) => items.filter((a) => a.assignees.some((assignee) => assignee.userId === user?.id)),
    [user?.id],
  );

  const fetchMonth = useCallback(async () => {
    const from = toDateInput(new Date(month.getFullYear(), month.getMonth(), 1));
    const to = toDateInput(new Date(month.getFullYear(), month.getMonth() + 1, 0));

    try {
      setLoading(true);
      setError('');

      if (scope === 'mine') {
        const mine = await activitiesApi.getMine({ from, to, limit: MONTH_FETCH_LIMIT });
        setActivities(selfAssignedOnly(mine.data));
        setTruncated(mine.meta.total > mine.data.length);
      } else if (scope === 'assigned') {
        const assigned = await activitiesApi.getAssigned({ from, to, limit: MONTH_FETCH_LIMIT });
        setActivities(assigned.data);
        setTruncated(assigned.meta.total > assigned.data.length);
      } else {
        const [mine, assigned] = await Promise.all([
          activitiesApi.getMine({ from, to, limit: MONTH_FETCH_LIMIT }),
          activitiesApi.getAssigned({ from, to, limit: MONTH_FETCH_LIMIT }),
        ]);

        const merged = new Map<string, Activity>();
        [...selfAssignedOnly(mine.data), ...assigned.data].forEach((activity) => merged.set(activity.id, activity));

        setActivities(Array.from(merged.values()));
        setTruncated(
          mine.meta.total > mine.data.length || assigned.meta.total > assigned.data.length,
        );
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load the calendar'));
    } finally {
      setLoading(false);
    }
  }, [month, scope, selfAssignedOnly]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void fetchMonth(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchMonth]);

  /** One pass over the month, so each cell is a map lookup rather than a scan. */
  const byDay = useMemo(() => {
    const map = new Map<string, Activity[]>();
    days.forEach((day) => {
      const key = toDateInput(day);
      const hits = activities
        .filter((activity) => coversDay(activity, key))
        .sort((a, b) => a.startAt.localeCompare(b.startAt));
      if (hits.length > 0) map.set(key, hits);
    });
    return map;
  }, [days, activities]);

  const selected = byDay.get(selectedKey) ?? [];
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shiftMonth = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  const goToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(toDateInput(now));
  };

  const openDay = (key: string) => {
    setSelectedKey(key);
    setDayOpen(true);
  };

  const selectedLabel = new Date(`${selectedKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="size-9"
              onClick={() => shiftMonth(-1)} aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </Button>
            <h2 className="min-w-36 text-center text-base font-bold">{monthLabel}</h2>
            <Button
              variant="outline" size="icon" className="size-9"
              onClick={() => shiftMonth(1)} aria-label="Next month"
            >
              <ChevronRight size={16} />
            </Button>
           
            <Button variant="outline" onClick={goToday} className="h-9 px-3 text-sm font-semibold ml-1">
              Today
            </Button>
          </div>

          {/* Scope Filter: Self task (default) vs Assigned vs All */}
          <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
             <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                scope === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                scope === 'mine'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Assigned by me
            </button>
            <button
              type="button"
              onClick={() => setScope('assigned')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                scope === 'assigned'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Assigned to me
            </button>
            
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {(['PENDING', 'COMPLETED', 'CANCELLED'] as ActivityStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${DOT_STYLES[status]}`} />
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm font-medium text-destructive">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {truncated && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          This month has more than {MONTH_FETCH_LIMIT} activities. Only the first {MONTH_FETCH_LIMIT}{' '}
          are shown here — use the other tabs with a date filter to see them all.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="px-2 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-24 border-b border-r p-2">
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = toDateInput(day);
              const items = byDay.get(key) ?? [];
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => openDay(key)}
                  aria-pressed={isSelected}
                  aria-label={`${day.toDateString()}, ${items.length} activities`}
                  className={`min-h-24 border-b border-r p-2 text-left align-top transition-colors ${
                    inMonth ? '' : 'bg-muted/30'
                  } ${isSelected ? 'ring-2 ring-inset ring-primary' : 'hover:bg-muted/40'}`}
                >
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-sm font-bold ${
                      isToday
                        ? 'bg-primary text-primary-foreground'
                        : inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/60'
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  <div className="mt-1 space-y-1">
                    {items.slice(0, 2).map((activity) => (
                      <span
                        key={activity.id}
                        className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs font-medium ${CHIP_STYLES[activity.status]}`}
                        title={`${activity.name} — ${activity.window}`}
                      >
                        {activity.recurrenceId && <Repeat size={9} className="shrink-0" />}
                        <span className="truncate">{activity.name}</span>
                      </span>
                    ))}
                    {items.length > 2 && (
                      <span className="block px-1 text-xs font-semibold text-muted-foreground">
                        +{items.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail dialog */}
      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarDays size={16} className="text-primary" />
              {selectedLabel}
            </DialogTitle>
          </DialogHeader>

          <p className="-mt-2 text-xs text-muted-foreground">
            {selected.length} activit{selected.length === 1 ? 'y' : 'ies'} scheduled
          </p>

          {selected.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing scheduled for this day.
            </p>
          ) : (
            <ul className="-mx-3 max-h-[60vh] divide-y overflow-y-auto">
              {selected.map((activity) => (
                <TaskRow
                  key={activity.id}
                  activity={activity}
                  actionable={false}
                  onViewDetails={setDetailTarget}
                  onUpdateStatus={setStatusTarget}
                />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
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

      {/* Status & Remarks Update Dialog */}
      {statusTarget && (
        <UpdateStatusDialog
          open
          activity={statusTarget}
          onClose={() => setStatusTarget(null)}
          onUpdated={() => {
            void fetchMonth();
          }}
        />
      )}
    </div>
  );
}
