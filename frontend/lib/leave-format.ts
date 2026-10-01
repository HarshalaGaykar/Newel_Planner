/**
 * Leave day counts are fractional by design — a half-day is 0.5 — but summing
 * floats surfaces noise like 20.999999999999996, which reached the UI verbatim.
 *
 * Show at most one decimal and drop a trailing ".0", so a whole balance reads
 * "12" while a genuine half-day still reads "1.5". Rounding to a whole number
 * would misstate an entitlement, so we deliberately don't.
 */
export function formatLeaveDays(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
