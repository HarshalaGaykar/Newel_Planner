'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  addMonths, eachDayOfInterval, endOfMonth, format, isSameMonth,
  isToday, isWeekend, startOfMonth, startOfWeek, endOfWeek,
} from 'date-fns';
import {
  AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock, Pencil, Plus,
} from 'lucide-react';
import {
  operationsApi, CalendarDay, CalendarEntry, TimesheetCalendarMonth, Timesheet, TimesheetEntry,
} from '@/lib/operations-api';
import { projectsApi, Project } from '@/lib/projects-api';
import { taskTypeMasterApi, TaskType } from '@/lib/task-type-master-api';
import { formatDayHeader, formatHours } from '@/lib/timesheet-format';
import { useAuthStore } from '@/lib/store/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import TimesheetEntryEditDialog from '@/components/timesheets/TimesheetEntryEditDialog';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function statusTone(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-muted text-muted-foreground';
    case 'SUBMITTED': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
    case 'RA_APPROVED': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300';
    case 'PM_APPROVED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
    case 'REJECTED': return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300';
    default: return 'bg-muted text-muted-foreground';
  }
}

/**
 * Cell shading for a day. Only working days can be a shortfall — the backend has
 * already excluded weekends, public holidays and full-day leave, so a quiet
 * Sunday never lights up red.
 */
function dayTone(day: CalendarDay | undefined) {
  if (!day) return '';
  if (!day.isWorkingDay) return '';
  if (day.hours === 0) return 'bg-red-50 dark:bg-red-950/30';
  if (day.isShortfall) return 'bg-amber-50 dark:bg-amber-950/30';
  return '';
}

function hoursTone(day: CalendarDay | undefined) {
  if (!day) return 'text-muted-foreground';
  if (day.isWorkingDay && day.isShortfall) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

/**
 * Month grid of logged hours. Fetches a whole month at once (totals *and* the
 * entries behind them), so clicking a date resolves its detail from state
 * without another round trip.
 *
 * Working days logging under the admin-configured threshold are highlighted, and
 * the day detail offers edit / add so hours can be corrected without leaving the
 * calendar.
 *
 * Pass `userId` to show a team member's hours instead of your own — the backend
 * enforces that the caller is allowed to see them, and the calendar drops to
 * read-only, since one person may not edit another's timesheet here.
 */
export default function TimesheetCalendar({ userId }: { userId?: string }) {
  const { user: authUser } = useAuthStore();
  const isOwnCalendar = !userId || userId === authUser?.id;

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [month, setMonth] = useState<TimesheetCalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Reference data the entry dialog needs. Fetched once, not per open.
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskTypeMasterTree, setTaskTypeMasterTree] = useState<TaskType[]>([]);
  const [backdatedDaysLimit, setBackdatedDaysLimit] = useState<number | null>(null);

  // Entry dialog state — editing an existing entry, or adding one to a date.
  const [editing, setEditing] = useState<{ entry: TimesheetEntry; timesheet: Timesheet } | null>(null);
  const [creating, setCreating] = useState<{ date: string; timesheet: Timesheet } | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  const monthParam = format(cursor, 'yyyy-MM');

  const fetchMonth = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setMonth(await operationsApi.getTimesheetCalendar({ month: monthParam, userId }));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load calendar'));
      setMonth(null);
    } finally {
      setLoading(false);
    }
  }, [monthParam, userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchMonth();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchMonth]);

  // Only needed for the edit/add flow, so skip it entirely on a team member's
  // calendar, which is read-only.
  useEffect(() => {
    if (!isOwnCalendar) return;
    void Promise.all([
      projectsApi.getAll().catch(() => [] as Project[]),
      taskTypeMasterApi.getTree().catch(() => [] as TaskType[]),
      operationsApi.getTimesheetSettings().catch(() => null),
    ]).then(([projectList, tree, settings]) => {
      setProjects(Array.isArray(projectList) ? projectList : []);
      setTaskTypeMasterTree(Array.isArray(tree) ? tree : []);
      setBackdatedDaysLimit(settings?.backdatedDaysLimit ?? null);
    });
  }, [isOwnCalendar]);

  // Moving months drops the open day detail, which belonged to the old month.
  const goToMonth = (next: Date) => {
    setCursor(next);
    setSelectedDate(null);
  };

  const hoursByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of month?.days ?? []) map.set(day.date, day);
    return map;
  }, [month]);

  // Pad to whole weeks (Mon–Sun) so the grid always has aligned rows.
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedDay = selectedDate ? hoursByDate.get(selectedDate) ?? null : null;
  const daysLogged = month?.daysLogged ?? 0;
  const minDailyHours = month?.minDailyHours ?? 7;
  const shortfallCount = (month?.days ?? []).filter(d => d.isShortfall).length;

  /**
   * A date outside the admin-configured creation window cannot get a weekly
   * timesheet, so adding an entry to it would fail server-side. Report that up
   * front instead of after a failed save.
   */
  const addBlockedReason = (date: string): string | null => {
    if (!isOwnCalendar) return 'You can only add entries to your own timesheet.';
    const target = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (target > today) return 'Future dates cannot be filled.';
    if (backdatedDaysLimit != null) {
      const earliest = new Date(today);
      earliest.setDate(earliest.getDate() - backdatedDaysLimit);
      if (target < earliest) {
        return `Only the last ${backdatedDaysLimit} day(s) can be filled. Older weeks need an administrator.`;
      }
    }
    return null;
  };

  /** The dialog needs the full TimesheetEntry, which the calendar payload trims. */
  const openEdit = async (entry: CalendarEntry) => {
    setDialogBusy(true);
    setError('');
    try {
      const timesheet = await operationsApi.getTimesheet(entry.timesheetId);
      const full = (timesheet.entries ?? []).find(e => e.id === entry.id);
      if (!full) throw new Error('This entry could no longer be found — it may have been deleted.');
      setEditing({ entry: full, timesheet });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to open the entry'));
    } finally {
      setDialogBusy(false);
    }
  };

  /** Resolve (or create) the weekly timesheet the date belongs to, then add to it. */
  const openCreate = async (date: string) => {
    if (!authUser?.id) return;
    setDialogBusy(true);
    setError('');
    try {
      const target = new Date(`${date}T00:00:00`);
      const dow = target.getDay();
      const monday = new Date(target);
      monday.setDate(target.getDate() + (dow === 0 ? -6 : 1 - dow));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const timesheet = await operationsApi.getOrCreateWeekly({
        userId: authUser.id,
        startDate: monday.toISOString(),
        endDate: sunday.toISOString(),
      });
      setCreating({ date, timesheet });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to open the timesheet for this date'));
    } finally {
      setDialogBusy(false);
    }
  };

  const afterSave = () => {
    setEditing(null);
    setCreating(null);
    void fetchMonth();
  };

  const blockedReason = selectedDate ? addBlockedReason(selectedDate) : null;

  return (
    <div className="space-y-4">
      {/* Header — month nav + month total */}
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => goToMonth(addMonths(cursor, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </Button>
          <div className="min-w-40 text-center text-sm font-bold">
            {format(cursor, 'MMMM yyyy')}
          </div>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => goToMonth(addMonths(cursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </Button>
          <Button
            variant="outline"
            className="h-8 px-2.5 text-xs font-semibold"
            onClick={() => goToMonth(startOfMonth(new Date()))}
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Clock size={13} className="text-primary" />
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span>
              <span className="text-foreground">{formatHours(month?.totalHours ?? 0)}</span>
              {' logged across '}
              <span className="text-foreground">{daysLogged}</span>
              {` day${daysLogged === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm font-medium text-destructive">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Legend — explains the shading before the user has to guess */}
      {!loading && month && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-red-100 dark:bg-red-950/60" />
            No hours logged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-100 dark:bg-amber-950/60" />
            Under {formatHours(minDailyHours)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border bg-card" />
            Weekend / holiday / leave
          </span>
          {shortfallCount > 0 && (
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {shortfallCount} day{shortfallCount === 1 ? '' : 's'} below target
            </span>
          )}
        </div>
      )}

      {/* Month grid */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {WEEKDAY_LABELS.map(label => (
            <div
              key={label}
              className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-16 border-b border-r p-2 last:border-r-0">
                <Skeleton className="h-3 w-4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {gridDays.map(day => {
              const iso = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, cursor);
              const dayData = hoursByDate.get(iso);
              const isSelected = selectedDate === iso;
              const hasHours = Boolean(dayData?.hours);

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : iso)}
                  disabled={!inMonth}
                  aria-pressed={isSelected}
                  title={dayData?.holidayName ?? undefined}
                  className={[
                    'flex min-h-16 flex-col items-start gap-1 border-b border-r p-2 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    inMonth ? 'hover:bg-muted/40' : 'bg-muted/20 cursor-default',
                    isWeekend(day) && inMonth ? 'bg-muted/10' : '',
                    inMonth ? dayTone(dayData) : '',
                    isSelected ? 'bg-primary/10 hover:bg-primary/15' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex size-5 items-center justify-center rounded-full text-[11px] font-bold',
                      inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                      isToday(day) ? 'bg-primary text-primary-foreground' : '',
                    ].join(' ')}
                  >
                    {format(day, 'd')}
                  </span>

                  {inMonth && hasHours && (
                    <span className={`text-[11px] font-bold ${hoursTone(dayData)}`}>
                      {formatHours(dayData!.hours)}
                    </span>
                  )}

                  {inMonth && !hasHours && dayData?.isHoliday && (
                    <span className="truncate text-[10px] font-medium text-muted-foreground">
                      {dayData.holidayName}
                    </span>
                  )}

                  {inMonth && !hasHours && !dayData?.isHoliday && dayData?.isLeave && (
                    <span className="text-[10px] font-medium text-muted-foreground">On leave</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail — a dialog so it is reachable without scrolling past the grid */}
      <Dialog open={selectedDate != null} onOpenChange={open => { if (!open) setSelectedDate(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <CalendarDays size={14} className="text-primary" />
              {selectedDate ? formatDayHeader(selectedDate) : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
            <span className="text-xs font-bold text-muted-foreground">
              Total <span className="text-foreground">{formatHours(selectedDay?.hours ?? 0)}</span>
              {selectedDay?.isShortfall && (
                <span className="ml-2 font-bold text-amber-600 dark:text-amber-400">
                  below {formatHours(minDailyHours)}
                </span>
              )}
            </span>

            {isOwnCalendar && selectedDate && (
              <Button
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs font-semibold"
                disabled={dialogBusy || !!blockedReason}
                title={blockedReason ?? undefined}
                onClick={() => void openCreate(selectedDate)}
              >
                <Plus size={13} /> Add entry
              </Button>
            )}
          </div>

          {blockedReason && isOwnCalendar && (
            <p className="px-1 text-[11px] text-muted-foreground">{blockedReason}</p>
          )}

          {selectedDay?.holidayName && (
            <p className="px-1 text-xs font-medium text-muted-foreground">
              Public holiday — {selectedDay.holidayName}
            </p>
          )}

          {!selectedDay || selectedDay.entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No hours logged on this date.
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {selectedDay.entries.map(entry => (
                <li key={entry.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {entry.projectName ?? 'Unassigned project'}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-tighter ${statusTone(entry.status)}`}
                        >
                          {entry.status.replace('_', ' ')}
                        </span>
                      </div>

                      {entry.taskName && (
                        <p className="truncate text-xs font-medium text-muted-foreground">
                          {entry.taskName}
                        </p>
                      )}

                      {entry.activity && (
                        <p className="text-[11px] text-muted-foreground">
                          {[entry.activity.type, entry.activity.activity, entry.activity.subActivity]
                            .filter(part => part && part !== '-')
                            .join(' › ')}
                        </p>
                      )}

                      {entry.description && (
                        <p className="whitespace-pre-wrap text-xs text-foreground/80">
                          {entry.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold tabular-nums">
                        {formatHours(entry.hours)}
                      </span>
                      {/* Only a draft entry is editable — once submitted it is part
                          of an approval trail. */}
                      {isOwnCalendar && entry.status === 'DRAFT' && (
                        <Button
                          variant="ghost" size="icon" className="size-7"
                          disabled={dialogBusy}
                          aria-label="Edit entry"
                          onClick={() => void openEdit(entry)}
                        >
                          <Pencil size={13} />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {editing && (
        <TimesheetEntryEditDialog
          entry={editing.entry}
          timesheet={editing.timesheet}
          projects={projects}
          taskTypeMasterTree={taskTypeMasterTree}
          canViewAll={['ADMIN', 'PM', 'TL'].includes(authUser?.role ?? '')}
          onOpenChange={open => { if (!open) setEditing(null); }}
          onSaved={afterSave}
        />
      )}

      {creating && (
        <TimesheetEntryEditDialog
          entry={null}
          createDate={creating.date}
          timesheet={creating.timesheet}
          projects={projects}
          taskTypeMasterTree={taskTypeMasterTree}
          canViewAll={['ADMIN', 'PM', 'TL'].includes(authUser?.role ?? '')}
          onOpenChange={open => { if (!open) setCreating(null); }}
          onSaved={afterSave}
        />
      )}
    </div>
  );
}
