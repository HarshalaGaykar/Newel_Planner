'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { tlDashboardApi, LeaveCalendarDay, LeaveCalendarEmployee } from '@/lib/tl-dashboard-api';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE_CHIPS = 2;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function LeaveChip({ employee }: { employee: LeaveCalendarEmployee }) {
  const approved = employee.status === 'APPROVED';
  return (
    <Avatar
      size="sm"
      title={`${employee.name} — ${employee.leaveType}${employee.isHalfDay ? ' (half day)' : ''} — ${approved ? 'Approved' : 'Pending'}`}
      className={cn(!approved && 'opacity-60 outline-dashed outline-1 outline-offset-1 outline-muted-foreground')}
    >
      <AvatarFallback className="text-[10px]">{initials(employee.name)}</AvatarFallback>
    </Avatar>
  );
}

function DayCell({ date, day, inCurrentMonth }: { date: Date; day: LeaveCalendarDay | undefined; inCurrentMonth: boolean }) {
  const employees = day?.employees ?? [];
  const visible = employees.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = employees.length - visible.length;
  const overflowNames = employees.slice(MAX_VISIBLE_CHIPS).map((e) => e.name).join(', ');

  return (
    <div
      className={cn(
        'min-h-20 p-1.5 border border-border/60 rounded-lg flex flex-col gap-1',
        !inCurrentMonth && 'bg-muted/30 opacity-50',
        isToday(date) && 'ring-1 ring-primary',
      )}
    >
      <span className={cn('text-xs font-medium', isToday(date) ? 'text-primary' : 'text-muted-foreground')}>
        {format(date, 'd')}
      </span>
      {employees.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-auto">
          {visible.map((e) => (
            <LeaveChip key={e.userId} employee={e} />
          ))}
          {overflow > 0 && (
            <span
              title={overflowNames}
              className="flex items-center justify-center size-6 rounded-full bg-muted text-[10px] font-medium text-muted-foreground shrink-0"
            >
              +{overflow}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamLeaveCalendar() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [data, setData] = useState<{ days: LeaveCalendarDay[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await tlDashboardApi.getLeaveCalendar(cursor.getMonth() + 1, cursor.getFullYear()));
    } catch {
      setData(null);
      setError('Failed to load the leave calendar.');
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    load();
  }, [load]);

  const gridDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      }),
    [cursor],
  );

  const dayByDate = useMemo(() => {
    const map = new Map<string, LeaveCalendarDay>();
    (data?.days ?? []).forEach((d) => map.set(d.date, d));
    return map;
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Leave Calendar</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium w-28 text-center">{format(cursor, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
            <ChevronRight size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border text-sm text-muted-foreground">
            <AlertCircle size={16} className="text-destructive shrink-0" />
            {error}
            <Button variant="outline" size="sm" onClick={load} className="ml-auto gap-1.5">
              <RefreshCw size={14} /> Retry
            </Button>
          </div>
        ) : loading || !data ? (
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 42 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {WEEKDAY_LABELS.map((d) => (
                <span key={d} className="text-xs font-medium text-muted-foreground text-center">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {gridDays.map((date) => (
                <DayCell
                  key={date.toISOString()}
                  date={date}
                  day={dayByDate.get(format(date, 'yyyy-MM-dd'))}
                  inCurrentMonth={isSameMonth(date, cursor)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
