/**
 * Calendar maths behind the attendance-compliance report (the "no check-in, no
 * leave, no timesheet" exception list).
 *
 * Everything here is pure and works on `YYYY-MM-DD` keys / `DateParts`, so the
 * whole range-resolution rule set is unit-testable without a database, and the
 * SQL layer only has to receive already-validated bounds. The SQL counterpart
 * lives in ReportsService.buildNonComplianceCtes.
 *
 * Note on date handling: attendance, leave and timesheet dates are stored as a
 * mix of `timestamptz` and naive `timestamp` columns (see schema.prisma).
 * Rather than guess a zone per column here, every helper works on the
 * *calendar* day, and the service converts the validated range into the exact
 * bound each column type needs.
 */

/**
 * Longest span the compliance report accepts. The result set is bounded by
 * headcount x days-in-range, and the Excel export has no pagination to bound
 * it, so a quarter is a generous ceiling that still cannot blow up memory.
 */
export const MAX_NON_COMPLIANCE_RANGE_DAYS = 93;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export type IsoWeekdayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

/** Index 0 = Monday … index 6 = Sunday. */
const WEEKDAY_CODES: readonly IsoWeekdayCode[] = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
];

const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a strict `YYYY-MM-DD` key into its parts, or null when it is not a real
 * calendar date. The regex alone is not enough — it happily accepts
 * `2026-02-31` and `2026-13-01`, so the value is round-tripped through `Date`
 * to reject anything the calendar would roll over.
 */
export function parseDateKey(value: string | null | undefined): DateParts | null {
  if (typeof value !== 'string') return null;

  const match = DATE_KEY_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Date.UTC normalises out-of-range values (month 13 -> next January), so an
  // unchanged round trip is the signal that the input was a real date.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function toDateKey(parts: DateParts): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** ISO weekday index: Monday = 0 … Sunday = 6. */
function isoWeekdayIndex(parts: DateParts): number {
  // `getUTCDay()` is Sunday-based (0 = Sun); rotate so Monday is 0, matching
  // both ISO-8601 and the MON/TUE/... codes stored in Shift.weekdays.
  const jsDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return (jsDay + 6) % 7;
}

/**
 * Three-letter weekday code for a day, matching the values stored in
 * `Shift.weekdays` so shift rosters can be matched without a lookup table.
 */
export function isoWeekdayCode(parts: DateParts): IsoWeekdayCode {
  return WEEKDAY_CODES[isoWeekdayIndex(parts)];
}

/**
 * Locale-independent English weekday name. Avoids SQL's `to_char(..., 'Day')`,
 * which follows the database's `lc_time` setting and can come back in another
 * language.
 */
export function isoWeekdayName(parts: DateParts): string {
  return WEEKDAY_NAMES[isoWeekdayIndex(parts)];
}

export function isWeekendDate(parts: DateParts): boolean {
  const index = isoWeekdayIndex(parts);
  return index === 5 || index === 6;
}

function compareParts(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/** Number of calendar days from `start` to `end`, inclusive of both. */
export function inclusiveDayCount(start: DateParts, end: DateParts): number {
  const from = Date.UTC(start.year, start.month - 1, start.day);
  const to = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((to - from) / 86_400_000) + 1;
}

export type NonComplianceRangeResolution =
  | {
      ok: true;
      start: DateParts;
      end: DateParts;
      /** Inclusive day count of the resolved range. */
      days: number;
      /** True when an end date past today was pulled back to today. */
      clampedToToday: boolean;
    }
  | {
      ok: false;
      reason: 'INVALID_DATE' | 'START_IN_FUTURE' | 'END_BEFORE_START' | 'RANGE_TOO_LARGE';
      message: string;
    };

/**
 * Resolve the report's date range from the query string.
 *
 * - Defaults to today only: the report's baseline question is "is today clean?".
 * - A start date with no end date means that single day, not "start → today".
 * - An end date past today is clamped, because a future day can never be
 *   non-compliant and returning empty pages would read as a clean report.
 * - Anything else that cannot produce a sensible range is an error rather than
 *   a silent fix-up, so a mistyped filter is visible instead of quietly
 *   returning the wrong week.
 */
export function resolveNonComplianceRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: DateParts,
): NonComplianceRangeResolution {
  const parsedStart = startDate ? parseDateKey(startDate) : null;
  if (startDate && !parsedStart) {
    return {
      ok: false,
      reason: 'INVALID_DATE',
      message: `startDate "${startDate}" is not a valid YYYY-MM-DD date`,
    };
  }

  const parsedEnd = endDate ? parseDateKey(endDate) : null;
  if (endDate && !parsedEnd) {
    return {
      ok: false,
      reason: 'INVALID_DATE',
      message: `endDate "${endDate}" is not a valid YYYY-MM-DD date`,
    };
  }

  const start = parsedStart ?? today;
  // Only treat the end as "implicit" when the caller gave no end date at all;
  // a start-only request is a request for that one day.
  const explicitEnd = parsedEnd ?? parsedStart;
  let end = explicitEnd ?? today;

  const clampedToToday = compareParts(end, today) > 0;
  if (clampedToToday) end = today;

  if (compareParts(end, start) < 0) {
    if (!explicitEnd) {
      return {
        ok: false,
        reason: 'START_IN_FUTURE',
        message:
          `startDate ${toDateKey(start)} is in the future — ` +
          `this report can only cover days up to ${toDateKey(today)}`,
      };
    }
    return {
      ok: false,
      reason: 'END_BEFORE_START',
      message: `endDate (${toDateKey(end)}) must be on or after startDate (${toDateKey(start)})`,
    };
  }

  const days = inclusiveDayCount(start, end);
  if (days > MAX_NON_COMPLIANCE_RANGE_DAYS) {
    return {
      ok: false,
      reason: 'RANGE_TOO_LARGE',
      message:
        `Date range spans ${days} days; this report accepts at most ` +
        `${MAX_NON_COMPLIANCE_RANGE_DAYS} days per request`,
    };
  }

  return { ok: true, start, end, days, clampedToToday };
}

