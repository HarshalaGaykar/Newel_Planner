'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertCircle, Repeat } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { activitiesApi, ActivityAssigneeOption } from '@/lib/activities-api';
import { toIsoDateTime, todayDateInput } from '@/lib/activity-datetime';
import AssigneeMultiSelect from './AssigneeMultiSelect';
import RecurrenceFields, {
  defaultRecurrenceValue, describeRecurrenceValue, partsFromDate,
  RepeatMode, toRecurrencePayload, validateRecurrence,
} from './RecurrenceFields';

// h-10 + text-sm: native date/time inputs reserve room for their picker icon,
// so at h-9/text-xs the value itself gets visually clipped.
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
  currentUserId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewActivityDialog({ open, currentUserId, onClose, onCreated }: Props) {
  const [options, setOptions] = useState<ActivityAssigneeOption[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() => (currentUserId ? [currentUserId] : []));
  const [startDate, setStartDate] = useState(todayDateInput);
  const [endDate, setEndDate] = useState(todayDateInput);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [recurrence, setRecurrence] = useState(() => defaultRecurrenceValue(todayDateInput()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const repeats = recurrence.frequency !== 'NONE';

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

  const handleFrequencyChange = (next: string) => {
    const { weekday, dayOfMonth } = partsFromDate(startDate);
    setRecurrence((prev) => ({
      ...prev,
      frequency: next as RepeatMode,
      byWeekday: next === 'WEEKLY' ? (prev.byWeekday?.length ? prev.byWeekday : [weekday]) : prev.byWeekday,
      byMonthDay: next === 'MONTHLY' ? (prev.byMonthDay || dayOfMonth) : prev.byMonthDay,
      byMonthDays: next === 'MONTHLY' ? (prev.byMonthDays?.length ? prev.byMonthDays : [dayOfMonth]) : prev.byMonthDays,
    }));
  };

  const handleSubmit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Activity name is required');
      return;
    }

    if (!startDate || !endDate) {
      setError('Start date and end date are required');
      return;
    }

    if (endDate < startDate) {
      setError('End date must be the same as or after start date');
      return;
    }

    if (!startTime || !endTime) {
      setError('Start time and end time are required');
      return;
    }

    const startAt = toIsoDateTime(startDate, startTime);
    // A repeating activity's window is the shape every occurrence takes, so it
    // has to sit inside one day — the series end is set by endDate.
    const endAt = toIsoDateTime(repeats ? startDate : endDate, endTime);

    if (!startAt || !endAt) {
      setError('Invalid date or time values');
      return;
    }

    if (new Date(endAt) < new Date(startAt)) {
      setError(
        repeats || startDate === endDate
          ? 'End time must be the same as or after the start time'
          : 'End must be the same as or after the start',
      );
      return;
    }

    if (repeats) {
      const recurrenceError = validateRecurrence(recurrence, startDate, endDate);
      if (recurrenceError) {
        setError(recurrenceError);
        return;
      }
    }

    try {
      setSaving(true);

      if (repeats) {
        const rule = toRecurrencePayload(recurrence, endDate);
        await activitiesApi.createRecurringActivity({
          name: name.trim(),
          description: description.trim() || undefined,
          assigneeIds,
          startAt,
          endAt,
          ...rule!,
        });
        toast.success('Recurring activity created');
      } else {
        await activitiesApi.createActivity({
          name: name.trim(),
          description: description.trim() || undefined,
          assigneeIds,
          startAt,
          endAt,
        });
        toast.success('Activity created');
      }

      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create activity'));
    } finally {
      setSaving(false);
    }
  };

  const preview = repeats ? describeRecurrenceValue(recurrence, startTime, endDate) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">New Activity</DialogTitle>
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
            <p className="text-[11px] text-muted-foreground">
              Defaults to you — remove yourself if the activity is only for someone else.
              Assignees get a read-only copy plus a notification.
            </p>
          </div>

          {/* 3 — Repeat selector */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Repeat size={13} />
              Repeat
            </Label>
            <Select value={recurrence.frequency} onValueChange={handleFrequencyChange} disabled={saving}>
              <SelectTrigger className="h-10 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Does not repeat</SelectItem>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4 — Start and end date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {repeats ? 'First Occurrence Date' : 'Start Date'}
              </Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {repeats ? 'Repeat Until Date' : 'End Date'}
              </Label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          {/* 5 — Start and end time */}
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

          {/* 6 — Conditional repeat options (holiday checkbox, weekday buttons, multi-day monthly) */}
          {repeats && (
            <RecurrenceFields
              value={recurrence}
              onChange={setRecurrence}
              startDate={startDate}
              disabled={saving}
            />
          )}

          {/* 7 — Description */}
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

          {preview && (
            <p className="rounded-md bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground border">
              {preview}
            </p>
          )}

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
              {saving ? 'Creating...' : repeats ? 'Create Recurring Activity' : 'Create Activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
