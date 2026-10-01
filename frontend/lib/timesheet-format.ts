// Shared timesheet display formatters, so the weekly detail page and the
// calendar render hours and day headings identically.

/** 7.5 → "7h 30m" */
export const formatHours = (h: number) => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
};

/**
 * "2026-07-29" → "Wednesday, Jul 29". Parsed at midday so a browser behind UTC
 * cannot roll the date back a day.
 */
export const formatDayHeader = (isoDate: string) =>
  new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
