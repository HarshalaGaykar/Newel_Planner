'use client';

import { useEffect, useState } from 'react';
import { operationsApi } from './operations-api';

/**
 * Mirror of backend/src/tasks/daily-effort.util.ts, used only for the live
 * "≈ h/day" hint while a form is being filled — the stored Task.dailyEffort
 * written by the API stays authoritative.
 *
 * Working days = inclusive Mon–Fri minus global, non-optional public holidays.
 */

export function countWorkingDays(start: Date, end: Date, holidayDates: Set<string>): number {
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let count = 0;
  while (cursor <= last) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(cursor.toISOString().slice(0, 10))) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function deriveDailyEffort(
  effort: number | null | undefined,
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  holidayDates: Set<string>,
): { dailyEffort: number; workingDays: number } | null {
  if (effort == null || !Number.isFinite(effort) || effort <= 0) return null;
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return null;
  const workingDays = Math.max(1, countWorkingDays(startDate, endDate, holidayDates));
  const dailyEffort = Math.round((effort / workingDays) * 10) / 10;
  return { dailyEffort, workingDays };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Holiday `YYYY-MM-DD` keys per year, fetched once and shared by all modals. */
const holidayKeysByYear = new Map<number, Set<string>>();
const inflightByYear = new Map<number, Promise<Set<string>>>();

function loadHolidayKeys(year: number): Promise<Set<string>> {
  const cached = holidayKeysByYear.get(year);
  if (cached) return Promise.resolve(cached);
  const inflight = inflightByYear.get(year);
  if (inflight) return inflight;
  const promise = operationsApi
    .getHolidays(year)
    .then((holidays) => {
      const keys = new Set(
        holidays
          .filter((h) => h.isGlobal !== false && !h.isOptional)
          .map((h) => String(h.date).slice(0, 10)),
      );
      holidayKeysByYear.set(year, keys);
      return keys;
    })
    .catch(() => new Set<string>())
    .finally(() => inflightByYear.delete(year));
  inflightByYear.set(year, promise);
  return promise;
}

function yearsFor(start?: string | null, end?: string | null): number[] {
  const currentYear = new Date().getFullYear();
  const from = Number(start?.slice(0, 4)) || currentYear;
  const to = Number(end?.slice(0, 4)) || from;
  const years: number[] = [];
  for (let year = Math.min(from, to); year <= Math.max(from, to) && years.length < 6; year++) {
    years.push(year);
  }
  return years;
}

/** Holiday keys spanning [start, end] (YYYY-MM-DD inputs) for the live hint. */
export function useHolidayDates(start?: string | null, end?: string | null): Set<string> {
  const [keys, setKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    Promise.all(yearsFor(start, end).map(loadHolidayKeys)).then((sets) => {
      if (!alive) return;
      const merged = new Set<string>();
      for (const set of sets) set.forEach((key) => merged.add(key));
      setKeys(merged);
    });
    return () => {
      alive = false;
    };
  }, [start, end]);

  return keys;
}
