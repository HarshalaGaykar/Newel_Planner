/**
 * Display labels for attendance rows. The API stores `status` as a plain string
 * (`PRESENT | LATE | HALF_DAY | ABSENT`, plus `REGULARIZED` once a request is
 * approved), so this is purely how those values are worded in the UI — nothing
 * here is ever sent back to the server.
 *
 * `ABSENT` reads as "Check-in Missing": a missing punch is what the record
 * actually proves, and calling it an absence accuses people of not showing up.
 */

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  HALF_DAY: 'Half Day',
  ABSENT: 'Check-in Missing',
  REGULARIZED: 'Regularized',
};

/** Falls back to a title-cased version of anything not in the map. */
export function attendanceStatusLabel(status: string): string {
  return ATTENDANCE_STATUS_LABELS[status] ?? titleCase(status);
}

/** `PENDING` → `Pending`, `HALF_DAY` → `Half Day`. */
export function titleCase(value: string): string {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
