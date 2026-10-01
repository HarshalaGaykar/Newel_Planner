'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  activitiesApi, Activity, ActivityAssigneeOption, UpdateActivityPayload,
} from '@/lib/activities-api';
import { isoToDateInput, isoToTimeInput, toIsoDateTime } from '@/lib/activity-datetime';
import AssigneeMultiSelect from './AssigneeMultiSelect';

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
  open: boolean;
  activity: Activity;
  onClose: () => void;
  onUpdated: () => void;
}

/**
 * Mounted only while open — each open always seeds from the current activity
 * so no stale state leaks from a previous edit.
 */
export default function EditActivityDialog({ open, activity, onClose, onUpdated }: Props) {
  const [options, setOptions] = useState<ActivityAssigneeOption[]>([]);
  const [name, setName] = useState(activity.name);
  const [description, setDescription] = useState(activity.description ?? '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    activity.assignees.map((a) => a.userId),
  );
  const [startDate, setStartDate] = useState(isoToDateInput(activity.startAt));
  const [endDate, setEndDate] = useState(isoToDateInput(activity.endAt));
  const [startTime, setStartTime] = useState(isoToTimeInput(activity.startAt));
  const [endTime, setEndTime] = useState(isoToTimeInput(activity.endAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await activitiesApi.getAssigneeOptions();
        if (!cancelled) setOptions(data);
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load members'));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Activity name is required');
      return;
    }

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
      const payload: UpdateActivityPayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        assigneeIds,
        startAt,
        endAt,
      };
      await activitiesApi.updateActivity(activity.id, payload);
      toast.success('Activity updated');
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update activity'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Activity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1 — Activity name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Activity Name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Prepare sprint demo deck"
              maxLength={200}
              className={FIELD_CLASS}
            />
          </div>

          {/* 2 — Assigned to */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assigned To</Label>
            <AssigneeMultiSelect
              options={options}
              value={assigneeIds}
              onChange={setAssigneeIds}
              disabled={saving}
            />
          </div>

          {/* 3 — Start and end date */}
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

          {/* 4 — Start and end time */}
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

          {/* 5 — Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description (optional)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
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
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
