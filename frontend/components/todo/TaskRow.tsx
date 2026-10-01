'use client';

import { CalendarClock, Check, Eye, History, MessageSquare, Pencil, Repeat, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar';
import { Activity, ActivityStatus } from '@/lib/activities-api';
import { dueLabel } from '@/lib/todo-grouping';

/** A single dot carries the status — colour is enough once rows are grouped. */
const DOT_STYLES: Record<ActivityStatus, string> = {
  PENDING: 'bg-blue-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
};

const DUE_TONE_STYLES = {
  overdue: 'text-destructive',
  today: 'text-foreground',
  muted: 'text-muted-foreground',
} as const;

const ACTION_CLASS =
  'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

interface Props {
  activity: Activity;
  /** False on the assigned tab — but assignees can still add remarks */
  actionable: boolean;
  busy?: boolean;
  onEdit?: (activity: Activity) => void;
  onPostpone?: (activity: Activity) => void;
  onComplete?: (activity: Activity) => void;
  onCancel?: (activity: Activity) => void;
  onViewDetails?: (activity: Activity) => void;
  onUpdateStatus?: (activity: Activity) => void;
}

export default function TaskRow({
  activity, actionable, busy, onEdit, onPostpone, onComplete, onCancel,
  onViewDetails, onUpdateStatus,
}: Props) {
  const isPending = activity.status === 'PENDING';
  const canAct = actionable && isPending;
  const due = dueLabel(activity);
  const isSelfAssigned =
    activity.assignees.length === 1
    && activity.assignees[0].userId === activity.createdById;

  return (
    <li
      className={`group/task relative flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 ${
        busy ? 'opacity-50' : ''
      }`}
    >
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT_STYLES[activity.status]}`}
        title={activity.status.charAt(0) + activity.status.slice(1).toLowerCase()}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <button
            type="button"
            onClick={() => onViewDetails?.(activity)}
            className={`text-left text-sm font-medium transition-colors hover:text-primary ${
              activity.status === 'COMPLETED' || activity.status === 'CANCELLED'
                ? 'text-muted-foreground line-through'
                : 'text-foreground'
            }`}
          >
            {activity.name}
          </button>

          {activity.recurrenceId && (
            <span
              className="inline-flex items-center text-violet-600 dark:text-violet-400"
              title="One occurrence of a repeating activity"
            >
              <Repeat size={12} />
            </span>
          )}

          {activity.postponeCount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              title={`Postponed ${activity.postponeCount} time(s)`}
            >
              <History size={10} />
              {activity.postponeCount}×
            </span>
          )}
        </div>

        {activity.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {activity.description}
          </p>
        )}

        {/* Ownership only earns a line when it is not simply "mine". */}
        {!isSelfAssigned && (
          <div className="mt-1 flex items-center gap-1.5">
            <AvatarGroup>
              {activity.assignees.slice(0, 3).map((assignee) => (
                <Avatar key={assignee.userId} size="sm" title={assignee.name}>
                  {assignee.avatarUrl && <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />}
                  <AvatarFallback>{initials(assignee.name)}</AvatarFallback>
                </Avatar>
              ))}
              {activity.assignees.length > 3 && (
                <AvatarGroupCount className="size-6 text-xs">
                  +{activity.assignees.length - 3}
                </AvatarGroupCount>
              )}
            </AvatarGroup>
            <span className="truncate text-xs text-muted-foreground">
              By {activity.createdByName}
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* Actions sit where the date is and swap in on hover, so a resting row
            stays quiet. Touch screens get no hover, so they show permanently. */}
        <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-focus-within/task:opacity-100 md:group-hover/task:opacity-100">
          {onViewDetails && (
            <button
              type="button" disabled={busy} title="View Details"
              onClick={() => onViewDetails(activity)} className={ACTION_CLASS}
            >
              <Eye size={14} />
            </button>
          )}

          {onUpdateStatus && (
            <button
              type="button" disabled={busy}
              title={activity.canManage ? 'Update Status & Remarks' : 'Add Remark'}
              onClick={() => onUpdateStatus(activity)}
              className={`${ACTION_CLASS} text-primary hover:bg-primary/10`}
            >
              <MessageSquare size={14} />
            </button>
          )}

          {canAct && (
            <>
              <button
                type="button" disabled={busy} title="Mark done"
                onClick={() => onComplete?.(activity)}
                className={`${ACTION_CLASS} hover:text-emerald-600 dark:hover:text-emerald-400`}
              >
                <Check size={15} />
              </button>
              <button
                type="button" disabled={busy} title="Postpone"
                onClick={() => onPostpone?.(activity)} className={ACTION_CLASS}
              >
                <CalendarClock size={14} />
              </button>
              <button
                type="button" disabled={busy} title="Edit"
                onClick={() => onEdit?.(activity)} className={ACTION_CLASS}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button" disabled={busy} title="Cancel"
                onClick={() => onCancel?.(activity)}
                className={`${ACTION_CLASS} hover:text-destructive`}
              >
                <X size={15} />
              </button>
            </>
          )}
        </div>

        <span
          className={`w-28 shrink-0 text-right text-xs font-medium tabular-nums ${DUE_TONE_STYLES[due.tone]}`}
          title={activity.window}
        >
          {due.text}
        </span>
      </div>
    </li>
  );
}
