/**
 * Working-day maths behind Task.dailyEffort — the average effort hours a task
 * carries per working day between its dates.
 *
 * Working days are inclusive Mon–Fri minus global, non-optional public
 * holidays: the same rule as leaves.service.ts and tmp-effort-calc.js. The
 * functions are pure and take the holiday set as `YYYY-MM-DD` keys, so callers
 * load a whole range's holidays once and tests need no database.
 */

/** `YYYY-MM-DD` key for a calendar day, independent of time-of-day. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Inclusive working-day count between `start` and `end`. Iterates in UTC so a
 * viewer's timezone can never shift a date onto the wrong weekday.
 * An `end` before `start` yields 0.
 */
export function countWorkingDays(
  start: Date,
  end: Date,
  holidayDates: Set<string>,
): number {
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const last = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  );
  let count = 0;
  while (cursor <= last) {
    const dayOfWeek = cursor.getUTCDay();
    if (
      dayOfWeek !== 0 &&
      dayOfWeek !== 6 &&
      !holidayDates.has(toDateKey(cursor))
    )
      count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * Spread `effort` hours over the working days of [start, end]:
 * `dailyEffort = effort / max(1, workingDays)`, rounded to one decimal.
 *
 * Returns null when there is nothing to derive (no positive effort or an
 * incomplete/invalid date pair). A weekend- or holiday-only span clamps to a
 * single day so it can never divide by zero.
 */
export function deriveDailyEffort(
  effort: number | null | undefined,
  start: Date | null | undefined,
  end: Date | null | undefined,
  holidayDates: Set<string>,
): { dailyEffort: number; workingDays: number } | null {
  if (effort == null || !Number.isFinite(effort) || effort <= 0) return null;
  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  )
    return null;

  const workingDays = Math.max(1, countWorkingDays(start, end, holidayDates));
  const dailyEffort = Math.round((effort / workingDays) * 10) / 10;
  return { dailyEffort, workingDays };
}
