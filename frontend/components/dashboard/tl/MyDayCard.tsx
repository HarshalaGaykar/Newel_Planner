'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { operationsApi, Attendance } from '@/lib/operations-api';

function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function formatTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const TIMESHEET_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  RA_APPROVED: 'RA Approved',
  PM_APPROVED: 'PM Approved',
  REJECTED: 'Rejected',
};

// Same tone convention used for the timesheet status badge in UserDashboard.tsx.
const TIMESHEET_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SUBMITTED: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  RA_APPROVED: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  PM_APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  REJECTED: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
};
const MISSING_BADGE = 'bg-amber-500/10 text-amber-700 dark:text-amber-400';

interface DashboardUserResponse {
  todayAttendance?: Attendance | null;
  myTimesheetStatus?: { thisWeek?: string | null } | null;
}

/**
 * Compact "me, right now" card for the TL dashboard header — today's check-in/
 * check-out and this week's own timesheet status. Reuses the exact data
 * `/dashboard/user` already returns (no new backend) and the same real-time
 * sync mechanism UserDashboard.tsx uses: any surface that checks a user in or
 * out dispatches a window `attendance-updated` event, which this listens for.
 */
export default function MyDayCard() {
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [timesheetStatus, setTimesheetStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardUserResponse>('/dashboard/user', { params: { timeZone: getBrowserTimeZone() } })
      .then((res) => {
        setAttendance(res.data.todayAttendance ?? null);
        setTimesheetStatus(res.data.myTimesheetStatus?.thisWeek ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = async () => {
      try {
        const updated = await operationsApi.getTodayAttendance(getBrowserTimeZone());
        setAttendance(updated ?? null);
      } catch {
        // Not checked in yet, or a transient error — keep the last known state.
      }
    };
    window.addEventListener('attendance-updated', handler);
    return () => window.removeEventListener('attendance-updated', handler);
  }, []);

  if (loading) {
    return <Skeleton className="h-16 w-full sm:w-72 rounded-xl" />;
  }

  const hasCheckedIn = !!attendance?.checkIn;

  return (
    <Card className="w-full sm:w-auto">
      <CardContent className="flex items-center gap-5 py-1">
        <div className="min-w-20">
          <p className="text-xs text-muted-foreground">Today</p>
          {hasCheckedIn ? (
            <>
              <p className="text-lg font-semibold text-foreground tabular-nums leading-tight">
                {formatTime(attendance?.checkIn)}
              </p>
              <p className="text-xs text-muted-foreground">
                {attendance?.checkOut ? `Out at ${formatTime(attendance.checkOut)}` : 'Still checked in'}
                {attendance?.isWfh ? ' · WFH' : ''}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-muted-foreground/50 tabular-nums leading-tight">--:--</p>
              <p className="text-xs text-muted-foreground">Not checked in yet</p>
            </>
          )}
        </div>

        <div className="h-9 w-px bg-border shrink-0" />

        <div>
          <p className="text-xs text-muted-foreground">This week&apos;s timesheet</p>
          <Badge
            className={cn(
              'mt-1 font-medium',
              timesheetStatus ? (TIMESHEET_STATUS_BADGE[timesheetStatus] ?? TIMESHEET_STATUS_BADGE.DRAFT) : MISSING_BADGE,
            )}
          >
            {timesheetStatus ? (TIMESHEET_STATUS_LABEL[timesheetStatus] ?? timesheetStatus) : 'Not started'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
