'use client';

import {
  CalendarDays, Clock, History, Repeat, User, Users,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Activity, ActivityStatus } from '@/lib/activities-api';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  activity: Activity | null;
  onClose: () => void;
  onUpdateStatusClick?: (activity: Activity) => void;
}

const STATUS_BADGE: Record<ActivityStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300' },
};

function formatActionType(type: string) {
  switch (type) {
    case 'CREATED': return 'Created';
    case 'POSTPONED': return 'Postponed';
    case 'COMPLETED': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
    case 'SERIES_CANCELLED': return 'Series Cancelled';
    case 'REMARK_ADDED': return 'Remark Added';
    default: return type;
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function ActivityDetailDialog({ open, activity, onClose, onUpdateStatusClick }: Props) {
  if (!activity) return null;

  const statusInfo = STATUS_BADGE[activity.status] ?? STATUS_BADGE.PENDING;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0 pr-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
                {activity.recurrenceId && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200">
                    <Repeat size={11} /> Recurring Series
                  </span>
                )}
                {activity.postponeCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                    <History size={11} /> Postponed {activity.postponeCount}×
                  </span>
                )}
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-snug break-words">
                {activity.name}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Schedule Window */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border text-xs sm:text-sm">
            <CalendarDays size={18} className="text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{activity.window}</p>
              <p className="text-xs text-muted-foreground">
                {activity.allDay ? 'All Day Window' : `Scheduled from ${format(new Date(activity.startAt), 'hh:mm a')} to ${format(new Date(activity.endAt), 'hh:mm a')}`}
              </p>
            </div>
          </div>

          {/* Description */}
          {activity.description && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</h4>
              <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap rounded-lg bg-card p-3 border leading-relaxed">
                {activity.description}
              </p>
            </div>
          )}

          {/* People: Creator & Assignees */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} /> Created By
              </span>
              <p className="text-sm font-medium text-foreground">{activity.createdByName}</p>
              <p className="text-[11px] text-muted-foreground">
                Created on {format(new Date(activity.createdAt), 'dd MMM yyyy, hh:mm a')}
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-card space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users size={13} /> Assigned To ({activity.assignees.length})
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {activity.assignees.map((assignee) => (
                  <div
                    key={assignee.userId}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary/80 px-2 py-0.5 text-xs text-foreground border"
                  >
                    <Avatar className="size-4">
                      {assignee.avatarUrl && <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />}
                      <AvatarFallback className="text-[9px]">{initials(assignee.name)}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-28 truncate">{assignee.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Action & Remarks Timeline */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={13} /> Activity History & Remarks
            </h4>

            {activity.actions && activity.actions.length > 0 ? (
              <div className="space-y-2.5 rounded-lg border bg-card p-3 max-h-52 overflow-y-auto">
                {activity.actions.map((act) => (
                  <div key={act.id} className="border-b last:border-b-0 pb-2.5 last:pb-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {act.actor?.firstName ? `${act.actor.firstName} ${act.actor.lastName ?? ''}`.trim() : 'System'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(act.createdAt), 'dd MMM yyyy, hh:mm a')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-medium h-5">
                        {formatActionType(act.type)}
                      </Badge>
                      {act.toStartAt && (
                        <span className="text-[11px] text-muted-foreground">
                          to {format(new Date(act.toStartAt), 'dd MMM, hh:mm a')}
                        </span>
                      )}
                    </div>

                    {act.remarks && (
                      <p className="text-xs text-foreground/90 bg-muted/40 rounded px-2.5 py-1.5 mt-1 border">
                        <span className="font-medium text-muted-foreground">Remark: </span>
                        {act.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">No history logged yet.</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-muted/20 flex items-center justify-between gap-2">
          {onUpdateStatusClick ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onUpdateStatusClick(activity);
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {activity.canManage ? 'Update Status / Add Remark' : 'Add Remark'}
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
