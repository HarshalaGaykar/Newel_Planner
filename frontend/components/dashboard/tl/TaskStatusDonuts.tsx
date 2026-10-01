'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DonutChart, DonutChartSegment } from '@/components/ui/donut-chart';
import { tlDashboardApi, StatusBucket, TasksByStatusResponse } from '@/lib/tl-dashboard-api';

// Same semantic tones used elsewhere in this app (TimesheetCalendar's
// hoursTone/dayTone): emerald = complete, amber = in flight, slate = neutral/not started.
const SEGMENT_COLORS = { backlog: '#94a3b8', wip: '#f59e0b', done: '#10b981' } as const;

function bucketToSegments(bucket: StatusBucket): DonutChartSegment[] {
  return [
    { label: 'Backlog', value: bucket.backlog, color: SEGMENT_COLORS.backlog },
    { label: 'WIP', value: bucket.wip, color: SEGMENT_COLORS.wip },
    { label: 'Done', value: bucket.done, color: SEGMENT_COLORS.done },
  ];
}

function TaskDonut({ title, bucket }: { title: string; bucket: StatusBucket }) {
  const segments = bucketToSegments(bucket);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <DonutChart
          data={segments}
          size={160}
          strokeWidth={20}
          centerContent={
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-2xl font-semibold text-foreground tabular-nums">{bucket.total}</p>
              <p className="text-xs text-muted-foreground">{bucket.total === 0 ? 'No tasks' : 'Tasks'}</p>
            </div>
          }
        />
        <div className="grid grid-cols-3 gap-2 w-full">
          {segments.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="text-sm font-semibold text-foreground tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TaskStatusDonuts() {
  const [data, setData] = useState<TasksByStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await tlDashboardApi.getTasksByStatus());
    } catch {
      setData(null);
      setError('Failed to load task status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card text-sm text-muted-foreground">
        <AlertCircle size={16} className="text-destructive shrink-0" />
        {error}
        <Button variant="outline" size="sm" onClick={load} className="ml-auto gap-1.5">
          <RefreshCw size={14} /> Retry
        </Button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TaskDonut title="Team Tasks" bucket={data.team} />
      <TaskDonut title="My Tasks" bucket={data.mine} />
    </div>
  );
}
