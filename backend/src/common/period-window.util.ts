import { getUtcForZonedLocalDateTime, getZonedDateParts } from '../attendance/time-zone.util';

export type DashboardPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Half-open range: [start, end). */
export interface PeriodWindow {
  start: Date;
  end: Date;
}

export interface PeriodWindows {
  current: PeriodWindow;
  prior: PeriodWindow;
}

/**
 * Resolves the "current" and immediately-preceding "prior" calendar window for
 * a Daily/Weekly/Monthly/Yearly period selector, both anchored to `referenceDate`
 * as seen in `timeZone` — not the server's local time zone.
 *
 * Monthly/Yearly compare against the previous calendar month/year (not a
 * rolling 30/365-day window), matching how period grouping works elsewhere in
 * this app (e.g. dashboard.service.ts's month-truncated aggregates).
 */
export function getPeriodWindows(
  period: DashboardPeriod,
  timeZone: string,
  referenceDate: Date = new Date(),
): PeriodWindows {
  const { year, month, day } = getZonedDateParts(referenceDate, timeZone);

  switch (period) {
    case 'DAILY': {
      const currentStart = getUtcForZonedLocalDateTime(timeZone, year, month, day);
      const currentEnd = getUtcForZonedLocalDateTime(timeZone, year, month, day + 1);
      const priorStart = getUtcForZonedLocalDateTime(timeZone, year, month, day - 1);
      return {
        current: { start: currentStart, end: currentEnd },
        prior: { start: priorStart, end: currentStart },
      };
    }

    case 'WEEKLY': {
      // Weekday is timezone-independent once we have the zoned calendar date.
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
      const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
      const currentStart = getUtcForZonedLocalDateTime(timeZone, year, month, day + mondayOffset);
      const currentEnd = getUtcForZonedLocalDateTime(timeZone, year, month, day + mondayOffset + 7);
      const priorStart = getUtcForZonedLocalDateTime(timeZone, year, month, day + mondayOffset - 7);
      return {
        current: { start: currentStart, end: currentEnd },
        prior: { start: priorStart, end: currentStart },
      };
    }

    case 'MONTHLY': {
      const currentStart = getUtcForZonedLocalDateTime(timeZone, year, month, 1);
      const currentEnd = getUtcForZonedLocalDateTime(timeZone, year, month + 1, 1);
      const priorStart = getUtcForZonedLocalDateTime(timeZone, year, month - 1, 1);
      return {
        current: { start: currentStart, end: currentEnd },
        prior: { start: priorStart, end: currentStart },
      };
    }

    case 'YEARLY': {
      const currentStart = getUtcForZonedLocalDateTime(timeZone, year, 1, 1);
      const currentEnd = getUtcForZonedLocalDateTime(timeZone, year + 1, 1, 1);
      const priorStart = getUtcForZonedLocalDateTime(timeZone, year - 1, 1, 1);
      return {
        current: { start: currentStart, end: currentEnd },
        prior: { start: priorStart, end: currentStart },
      };
    }
  }
}

export interface Trend {
  currentPeriodCount: number;
  priorPeriodCount: number;
  /** null when there's no prior-period data to compare against (never a division by zero). */
  trendPct: number | null;
  direction: 'UP' | 'DOWN' | 'FLAT' | 'NEW';
}

/**
 * Rise/fall % between two period counts. Returns a structured result rather
 * than a raw number so the frontend never has to special-case NaN/Infinity —
 * `priorPeriodCount === 0` yields `trendPct: null` with an explicit direction
 * ('NEW' if something showed up with no prior baseline, else 'FLAT').
 */
export function computeTrend(currentPeriodCount: number, priorPeriodCount: number): Trend {
  if (priorPeriodCount === 0) {
    return {
      currentPeriodCount,
      priorPeriodCount,
      trendPct: null,
      direction: currentPeriodCount > 0 ? 'NEW' : 'FLAT',
    };
  }

  const trendPct = Math.round(((currentPeriodCount - priorPeriodCount) / priorPeriodCount) * 1000) / 10;
  return {
    currentPeriodCount,
    priorPeriodCount,
    trendPct,
    direction: trendPct > 0 ? 'UP' : trendPct < 0 ? 'DOWN' : 'FLAT',
  };
}
