'use client';

import { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from '@/lib/activities-api';
import { groupActivities } from '@/lib/todo-grouping';
import TaskGroup from './TaskGroup';

interface Props {
  activities: Activity[];
  loading: boolean;
  /** False on the assigned tab for edit/cancel, but status updates can still be enabled */
  actionable: boolean;
  busyId?: string | null;
  emptyHint: string;
  onEdit?: (activity: Activity) => void;
  onPostpone?: (activity: Activity) => void;
  onComplete?: (activity: Activity) => void;
  onCancel?: (activity: Activity) => void;
  onViewDetails?: (activity: Activity) => void;
  onUpdateStatus?: (activity: Activity) => void;
}

export default function TaskList({
  activities, loading, actionable, busyId, emptyHint,
  onEdit, onPostpone, onComplete, onCancel,
  onViewDetails, onUpdateStatus,
}: Props) {
  // Buckets come from the loaded page, so this recomputes with every fetch
  // rather than holding a stale grouping.
  const groups = useMemo(() => groupActivities(activities), [activities]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {loading ? (
        <ul className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3 px-3 py-3">
              <Skeleton className="mt-0.5 size-4 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <Skeleton className="h-3.5 w-20" />
            </li>
          ))}
        </ul>
      ) : activities.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <ClipboardList className="mx-auto mb-3 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">Nothing here yet</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        groups.map((group) => (
          <TaskGroup
            key={group.bucket}
            bucket={group.bucket}
            items={group.items}
            actionable={actionable}
            busyId={busyId}
            onEdit={onEdit}
            onPostpone={onPostpone}
            onComplete={onComplete}
            onCancel={onCancel}
            onViewDetails={onViewDetails}
            onUpdateStatus={onUpdateStatus}
          />
        ))
      )}
    </div>
  );
}
