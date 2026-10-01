'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { CreateRecurringActivityPayload, RecurrenceFrequency } from '@/lib/activities-api';

const FIELD_CLASS =
  'w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `NONE` keeps the plain one-off activity path — recurrence is opt-in. */
export type RepeatMode = 'NONE' | RecurrenceFrequency;

export interface RecurrenceValue {
  frequency: RepeatMode;
  interval: number;
  byWeekday: number[];
  byMonthDay: number;
  byMonthDays: number[];
  seriesEndDate: string;
  maxOccurrences?: number;
  skipNonWorkingDays: boolean;
}

/** `yyyy-MM-dd` → the weekday / day-of-month the rule should default to. */
export function partsFromDate(startDate: string) {
  const [year, month, day] = startDate.split('-').map(Number);
  if (!year || !month || !day) return { weekday: new Date().getDay(), dayOfMonth: 1 };
  return { weekday: new Date(year, month - 1, day).getDay(), dayOfMonth: day };
}

export function parseMonthDays(raw: string): number[] {
  if (!raw.trim()) return [];
  const parts = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const nums = parts.map((p) => parseInt(p, 10)).filter((n) => !isNaN(n));
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

export function formatMonthDays(days: number[]): string {
  return days.join(', ');
}

export function defaultRecurrenceValue(startDate: string): RecurrenceValue {
  const { weekday, dayOfMonth } = partsFromDate(startDate);
  return {
    frequency: 'NONE',
    interval: 1,
    byWeekday: [weekday],
    byMonthDay: dayOfMonth,
    byMonthDays: [dayOfMonth],
    seriesEndDate: '',
    skipNonWorkingDays: false,
  };
}

/**
 * Plain-language echo of the rule.
 */
export function describeRecurrenceValue(
  value: RecurrenceValue,
  startTime: string,
  endDate?: string,
): string {
  if (value.frequency === 'NONE') return '';

  let text = '';
  if (value.frequency === 'DAILY') {
    text = 'Every day';
  } else if (value.frequency === 'WEEKLY') {
    const days = [...value.byWeekday].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]);
    if (days.length === 0) return 'Pick at least one weekday';
    text = `Every week on ${days.join(', ')}`;
  } else {
    const days = (value.byMonthDays && value.byMonthDays.length > 0)
      ? value.byMonthDays
      : [value.byMonthDay || 1];
    text = `Every month on day ${days.join(', ')}`;
  }

  if (startTime) text += `, ${startTime}`;
  const effectiveEnd = endDate || value.seriesEndDate;
  if (effectiveEnd) text += ` until ${effectiveEnd}`;
  if (value.skipNonWorkingDays) text += ' — skipping weekends & public holidays';

  return text;
}

/** Returns the recurrence half of the create payload, or null for a one-off. */
export function toRecurrencePayload(
  value: RecurrenceValue,
  seriesEndDate?: string,
): Pick<
  CreateRecurringActivityPayload,
  'frequency' | 'interval' | 'byWeekday' | 'byMonthDay' | 'byMonthDays' | 'seriesEndDate' | 'skipNonWorkingDays'
> | null {
  if (value.frequency === 'NONE') return null;

  const effectiveEnd = seriesEndDate || value.seriesEndDate;

  return {
    frequency: value.frequency,
    interval: 1,
    skipNonWorkingDays: value.skipNonWorkingDays,
    ...(value.frequency === 'WEEKLY' ? { byWeekday: [...value.byWeekday].sort((a, b) => a - b) } : {}),
    ...(value.frequency === 'MONTHLY'
      ? {
          byMonthDay: value.byMonthDays?.[0] ?? value.byMonthDay ?? 1,
          byMonthDays: (value.byMonthDays && value.byMonthDays.length > 0)
            ? [...value.byMonthDays].sort((a, b) => a - b)
            : [value.byMonthDay ?? 1],
        }
      : {}),
    ...(effectiveEnd ? { seriesEndDate: effectiveEnd } : {}),
  };
}

/** Client-side guard so an unsatisfiable rule never reaches the API. */
export function validateRecurrence(value: RecurrenceValue, startDate: string, endDate?: string): string | null {
  if (value.frequency === 'NONE') return null;

  if (value.frequency === 'WEEKLY' && value.byWeekday.length === 0) {
    return 'Pick at least one weekday to repeat on';
  }

  if (
    value.frequency === 'WEEKLY'
    && value.skipNonWorkingDays
    && value.byWeekday.every((day) => day === 0 || day === 6)
  ) {
    return 'Every selected day is a weekend, but weekends are set to be skipped — pick a weekday or turn the skip off';
  }

  if (value.frequency === 'MONTHLY') {
    const days = value.byMonthDays || [];
    if (days.length === 0) {
      return 'Enter at least one day of the month (1–31)';
    }
    const outOfRange = days.filter((d) => d < 1 || d > 31);
    if (outOfRange.length > 0) {
      return 'Day of month must be between 1 and 31';
    }
  }

  const effectiveEnd = endDate || value.seriesEndDate;
  if (effectiveEnd && effectiveEnd < startDate) {
    return 'The end date cannot be before the start date';
  }

  return null;
}

interface Props {
  value: RecurrenceValue;
  onChange: (next: RecurrenceValue) => void;
  startDate: string;
  disabled?: boolean;
}

/**
 * Recurrence conditional fields:
 * - Weekly: Weekday pills
 * - Monthly: Comma-separated Day of Month input (1–31)
 * - Daily / Weekly / Monthly: Holiday checkbox
 */
export default function RecurrenceFields({ value, onChange, startDate, disabled }: Props) {
  const set = (patch: Partial<RecurrenceValue>) => onChange({ ...value, ...patch });

  const [rawMonthDays, setRawMonthDays] = useState(() =>
    formatMonthDays(value.byMonthDays?.length ? value.byMonthDays : [partsFromDate(startDate).dayOfMonth]),
  );

  const toggleWeekday = (day: number) => {
    set({
      byWeekday: value.byWeekday.includes(day)
        ? value.byWeekday.filter((d) => d !== day)
        : [...value.byWeekday, day],
    });
  };

  const handleMonthDaysChange = (raw: string) => {
    // Only allow numbers, commas, and spaces
    const sanitized = raw.replace(/[^0-9,\s]/g, '');
    setRawMonthDays(sanitized);
    const parsed = parseMonthDays(sanitized);
    const valid = parsed.filter((d) => d >= 1 && d <= 31);
    set({ byMonthDays: valid, byMonthDay: valid[0] || 1 });
  };

  const handleMonthDaysBlur = () => {
    const parsed = parseMonthDays(rawMonthDays);
    const clamped = parsed
      .map((d) => Math.min(31, Math.max(1, d)))
      .filter((d) => d >= 1 && d <= 31);
    const unique = Array.from(new Set(clamped)).sort((a, b) => a - b);
    const fallback = unique.length > 0 ? unique : [partsFromDate(startDate).dayOfMonth || 1];
    set({ byMonthDays: fallback, byMonthDay: fallback[0] });
    setRawMonthDays(formatMonthDays(fallback));
  };

  if (value.frequency === 'NONE') return null;

  return (
    <div className="space-y-3">
      {/* Holiday checkbox for Daily, Weekly, Monthly */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-muted/20 p-2.5">
        <input
          type="checkbox"
          checked={value.skipNonWorkingDays}
          onChange={(e) => set({ skipNonWorkingDays: e.target.checked })}
          disabled={disabled}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
        />
        <span>
          <span className="block text-xs font-semibold">Skip weekends &amp; public holidays</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            Occurrences landing on Saturday, Sunday, or non-optional public holidays are skipped.
          </span>
        </span>
      </label>

      {/* Weekly days selector */}
      {value.frequency === 'WEEKLY' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Repeat On</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, day) => {
              const selected = value.byWeekday.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleWeekday(day)}
                  aria-pressed={selected}
                  className={`h-8 w-11 rounded-md border text-[11px] font-bold transition-colors ${
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Day of Month input (comma-separated for multiple dates) */}
      {value.frequency === 'MONTHLY' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Day Of Month (comma separated for multiple dates)</Label>
          <input
            type="text"
            value={rawMonthDays}
            onChange={(e) => handleMonthDaysChange(e.target.value)}
            onBlur={handleMonthDaysBlur}
            disabled={disabled}
            placeholder="e.g. 1, 15, 28"
            className={FIELD_CLASS}
          />
          <p className="text-[11px] text-muted-foreground">
            Enter one or more days (1–31) separated by commas. Short months clamp to their last day.
          </p>
        </div>
      )}
    </div>
  );
}
