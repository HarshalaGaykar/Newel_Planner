/**
 * Named periods for the Todo filters. The list defaults to All so a user lands
 * on what they actually have to do now rather than on every activity they have
 * ever created.
 *
 * Ranges are inclusive `yyyy-MM-dd` strings, matching the `from` / `to` query
 * the activities API already takes — which filters on window *overlap*, so a
 * multi-day activity spanning today still shows under Today.
 */

export type TodoPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'UPCOMING' | 'ALL' | 'CUSTOM';

export const PERIOD_OPTIONS: { value: TodoPeriod; label: string }[] = [
  { value: 'ALL', label: 'All Dates' },
  { value: 'TODAY', label: 'Today' },
  { value: 'WEEK', label: 'This Week' },
  { value: 'MONTH', label: 'This Month' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'CUSTOM', label: 'Custom Range' },
];

export const DEFAULT_PERIOD: TodoPeriod = 'ALL';

/** Local-time `yyyy-MM-dd`; `toISOString` would shift the day in most timezones. */
export function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Resolves a period to the `from` / `to` the API expects. `undefined` on either
 * end means "unbounded in that direction".
 */
export function resolvePeriod(
  period: TodoPeriod,
  custom: { from: string; to: string },
): { from?: string; to?: string } {
  const today = new Date();

  switch (period) {
    case 'TODAY':
      return { from: toDateInput(today), to: toDateInput(today) };

    case 'WEEK': {
      // Week runs Sunday–Saturday, matching the weekday picker in the repeat rule.
      const start = addDays(today, -today.getDay());
      return { from: toDateInput(start), to: toDateInput(addDays(start, 6)) };
    }

    case 'MONTH': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toDateInput(start), to: toDateInput(end) };
    }

    case 'UPCOMING':
      // Open-ended forward — everything from today on, however far out.
      return { from: toDateInput(today) };

    case 'CUSTOM':
      return { from: custom.from || undefined, to: custom.to || undefined };

    case 'ALL':
    default:
      return {};
  }
}

/** Human label for the active range, shown above the list. */
export function describePeriod(period: TodoPeriod, custom: { from: string; to: string }): string {
  const option = PERIOD_OPTIONS.find(o => o.value === period);
  if (period !== 'CUSTOM') return option?.label ?? '';
  if (custom.from && custom.to) return `${custom.from} to ${custom.to}`;
  if (custom.from) return `From ${custom.from}`;
  if (custom.to) return `Up to ${custom.to}`;
  return 'Custom Range';
}
