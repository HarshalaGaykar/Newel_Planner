// The activity form collects date and time separately, while the API stores a
// single instant per end of the window. These helpers convert between the two.

/**
 * Combines a `yyyy-MM-dd` date and an `HH:mm` time into an ISO string in the
 * user's local timezone. `new Date('2026-08-03')` would be parsed as UTC and can
 * land on the previous day, so the parts are passed to the Date constructor
 * individually instead.
 */
export function toIsoDateTime(date: string, time: string, endOfDayIfNoTime = false): string | null {
  if (!date) return null;

  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;

  let hours = endOfDayIfNoTime ? 23 : 0;
  let minutes = endOfDayIfNoTime ? 59 : 0;

  if (time) {
    const [h, m] = time.split(':').map(Number);
    if (Number.isFinite(h)) hours = h;
    if (Number.isFinite(m)) minutes = m;
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

/** ISO instant → `yyyy-MM-dd` in local time. */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** ISO instant → `HH:mm` in local time. */
export function isoToTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function todayDateInput(): string {
  return isoToDateInput(new Date().toISOString());
}
