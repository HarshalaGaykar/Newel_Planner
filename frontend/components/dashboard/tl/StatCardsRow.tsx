'use client';

import { useEffect, useState, useCallback } from 'react';
import { FolderKanban, CalendarClock, FileClock, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { tlDashboardApi, DashboardPeriod, TlStatsResponse } from '@/lib/tl-dashboard-api';
import StatCard from './StatCard';

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

export default function StatCardsRow() {
  const [period, setPeriod] = useState<DashboardPeriod>('WEEKLY');
  const [stats, setStats] = useState<TlStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await tlDashboardApi.getStats(period));
    } catch {
      setStats(null);
      setError('Failed to load stats.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
          <TabsList shape="pill" className="grid grid-cols-4 w-full max-w-md">
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card text-sm text-muted-foreground">
          <AlertCircle size={16} className="text-destructive shrink-0" />
          {error}
          <Button variant="outline" size="sm" onClick={load} className="ml-auto gap-1.5">
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      ) : loading || !stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Projects" icon={FolderKanban} count={stats.activeProjects.count} trend={stats.activeProjects.trend} />
          <StatCard label="Leave Requests Pending" icon={CalendarClock} count={stats.leaveRequestsPending.count} trend={stats.leaveRequestsPending.trend} />
          <StatCard label="Timesheet Approvals Pending" icon={FileClock} count={stats.timesheetApprovalsPending.count} trend={stats.timesheetApprovalsPending.trend} />
          <StatCard label="Total Resources" icon={Users} count={stats.totalResources.count} trend={stats.totalResources.trend} />
        </div>
      )}
    </div>
  );
}
