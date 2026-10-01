/**
 * Client-side bucketing for the Todo list. The API returns a pre-formatted
 * `window` string, but grouping and relative labels need the raw `startAt` /
 * `endAt` — both of which are already on every activity — so none of this
 * costs an extra request.
 *
 * Buckets are derived from the *loaded* page only. Counts shown against a group
 * therefore describe what is on screen, never the server total.
 */

import {
  differenceInCalendarDays, endOfDay, format, isSameYear, startOfDay,
} from 'date-fns';
import { Activity } from '@/lib/activities-api';

export type TaskBucket =
  | 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'LATER' | 'CLOSED';

/** Render order — earliest commitment first, closed work last. */
const BUCKET_ORDER: TaskBucket[] = [
  'OVERDUE', 'TODAY', 'TOMORROW', 'THIS_WEEK', 'LATER', 'CLOSED',
];

export const BUCKET_LABELS: Record<TaskBucket, string> = {
  OVERDUE: 'Overdue',
  TODAY: 'Today',
  TOMORROW: 'Tomorrow',
  THIS_WEEK: 'This week',
  LATER: 'Later',
  CLOSED: 'Closed',
};

/** Groups that would otherwise push the urgent ones off-screen start folded. */
const COLLAPSED_BY_DEFAULT: TaskBucket[] = ['LATER', 'CLOSED'];

export function startsCollapsed(bucket: TaskBucket) {
  return COLLAPSED_BY_DEFAULT.includes(bucket);
}

export interface TaskGroupData {
  bucket: TaskBucket;
  items: Activity[];
}

function bucketOf(activity: Activity, now: Date): TaskBucket {
  if (activity.status !== 'PENDING') return 'CLOSED';

  const today = startOfDay(now);
  const start = new Date(activity.startAt);
  const end = new Date(activity.endAt);

  // An activity is a window, not a point: it counts as today's work whenever it
  // overlaps today, even if it started last week.
  if (end < today) return 'OVERDUE';
  if (start <= endOfDay(now)) return 'TODAY';

  const daysOut = differenceInCalendarDays(start, today);
  if (daysOut === 1) return 'TOMORROW';

  // Week runs Sunday–Saturday, matching resolvePeriod() and the weekday picker.
  if (daysOut <= 6 - now.getDay()) return 'THIS_WEEK';

  return 'LATER';
}

/**
 * Buckets a page of activities. Only non-empty groups come back, so the caller
 * never renders a header for a group it has nothing to show in.
 */
export function groupActivities(activities: Activity[], now = new Date()): TaskGroupData[] {
  const map = new Map<TaskBucket, Activity[]>();

  activities.forEach((activity) => {
    const bucket = bucketOf(activity, now);
    const existing = map.get(bucket);
    if (existing) existing.push(activity);
    else map.set(bucket, [activity]);
  });

  return BUCKET_ORDER.flatMap((bucket) => {
    const items = map.get(bucket);
    if (!items?.length) return [];

    // Open work reads forwards (what is due first); closed work reads backwards
    // (what was finished most recently).
    const sorted = [...items].sort((a, b) =>
      bucket === 'CLOSED'
        ? b.startAt.localeCompare(a.startAt)
        : a.startAt.localeCompare(b.startAt),
    );

    return [{ bucket, items: sorted }];
  });
}

export type DueTone = 'overdue' | 'today' | 'muted';

export interface DueLabel {
  text: string;
  tone: DueTone;
}

/** Short, scannable stand-in for the server's long `window` string. */
export function dueLabel(activity: Activity, now = new Date()): DueLabel {
  const today = startOfDay(now);
  const start = new Date(activity.startAt);
  const end = new Date(activity.endAt);
  const time = activity.allDay
    ? 'All day'
    : format(start, 'HH:mm');

  if (activity.status !== 'PENDING') {
    return { text: format(start, isSameYear(start, now) ? 'd MMM' : 'd MMM yyyy'), tone: 'muted' };
  }

  if (end < today) {
    const days = differenceInCalendarDays(today, startOfDay(end));
    return {
      text: days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`,
      tone: 'overdue',
    };
  }

  const daysOut = differenceInCalendarDays(start, today);
  if (daysOut <= 0) return { text: time, tone: 'today' };
  if (daysOut === 1) return { text: `Tomorrow · ${time}`, tone: 'muted' };
  if (daysOut <= 6) return { text: `${format(start, 'EEE')} · ${time}`, tone: 'muted' };

  return {
    text: `${format(start, isSameYear(start, now) ? 'd MMM' : 'd MMM yyyy')} · ${time}`,
    tone: 'muted',
  };
}
