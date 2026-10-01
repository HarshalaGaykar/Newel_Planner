'use client';

import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { activitiesApi, Activity } from '@/lib/activities-api';
import { isoToDateInput, isoToTimeInput, toIsoDateTime } from '@/lib/activity-datetime';

// See NewActivityDialog — native date/time inputs need h-10/text-sm to render
// their value without clipping.
const FIELD_CLASS =
  'w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

interface Props {
  activity: Activity;
  onClose: () => void;
  onPostponed: () => void;
}

/**
 * Mounted only once an activity is picked, so the fields seed straight from the
 * current window via their initialisers rather than a syncing effect.
 */
export default function PostponeActivityDialog({ activity, onClose, onPostponed }: Props) {
  const [startDate, setStartDate] = useState(() => isoToDateInput(activity.startAt));
  const [endDate, setEndDate] = useState(() => isoToDateInput(activity.endAt));
  const [startTime, setStartTime] = useState(() => isoToTimeInput(activity.startAt));
  const [endTime, setEndTime] = useState(() => isoToTimeInput(activity.endAt));
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setError('');

    const startAt = toIsoDateTime(startDate, startTime);
    const endAt = toIsoDateTime(endDate, endTime);

    if (!startAt || !endAt) {
      setError('Start date and end date are required');
      return;
    }

    if (new Date(endAt) < new Date(startAt)) {
      setError('End must be the same as or after the start');
      return;
    }

    try {
      setSaving(true);
      await activitiesApi.postponeActivity(activity.id, {
        startAt,
        endAt,
        // Explicit times only now that the all-day option is gone; this also
        // normalises any activity created back when it was available.
        allDay: false,
        remarks: remarks.trim() || undefined,
      });
      toast.success('Activity postponed');
      onPostponed();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to postpone activity'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      {/* `sm:` prefix required — DialogContent's base is `sm:max-w-sm`. */}
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Postpone Activity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-bold">{activity.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Currently {activity.window}</p>
          </div>

          {/* Same row order as New Activity: dates, then times, then text. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Date</Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">End Date</Label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Time</Label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">End Time</Label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reason (optional)</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Shared with the assignees"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="h-8 text-xs">
              {saving ? 'Postponing...' : 'Postpone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
