'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Activity } from '@/lib/activities-api';
import { BUCKET_LABELS, TaskBucket, startsCollapsed } from '@/lib/todo-grouping';
import TaskRow from './TaskRow';

interface Props {
  bucket: TaskBucket;
  items: Activity[];
  actionable: boolean;
  busyId?: string | null;
  onEdit?: (activity: Activity) => void;
  onPostpone?: (activity: Activity) => void;
  onComplete?: (activity: Activity) => void;
  onCancel?: (activity: Activity) => void;
  onViewDetails?: (activity: Activity) => void;
  onUpdateStatus?: (activity: Activity) => void;
}

export default function TaskGroup({
  bucket, items, actionable, busyId, onEdit, onPostpone, onComplete, onCancel,
  onViewDetails, onUpdateStatus,
}: Props) {
  const [open, setOpen] = useState(() => !startsCollapsed(bucket));
  const isOverdue = bucket === 'OVERDUE';

  return (
    <section className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60"
      >
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
        />
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            isOverdue ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {BUCKET_LABELS[bucket]}
        </span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </button>

      {open && (
        <ul className="divide-y">
          {items.map((activity) => (
            <TaskRow
              key={activity.id}
              activity={activity}
              actionable={actionable}
              busy={busyId === activity.id}
              onEdit={onEdit}
              onPostpone={onPostpone}
              onComplete={onComplete}
              onCancel={onCancel}
              onViewDetails={onViewDetails}
              onUpdateStatus={onUpdateStatus}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
