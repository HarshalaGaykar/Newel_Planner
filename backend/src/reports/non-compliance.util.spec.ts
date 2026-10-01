import {
  MAX_NON_COMPLIANCE_RANGE_DAYS,
  inclusiveDayCount,
  isWeekendDate,
  isoWeekdayCode,
  isoWeekdayName,
  parseDateKey,
  resolveNonComplianceRange,
  toDateKey,
} from './non-compliance.util';

const TODAY = { year: 2026, month: 9, day: 30 }; // a Wednesday

describe('parseDateKey', () => {
  it('parses a real calendar date', () => {
    expect(parseDateKey('2026-09-30')).toEqual({ year: 2026, month: 9, day: 30 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDateKey('  2026-09-30  ')).toEqual({ year: 2026, month: 9, day: 30 });
  });

  it('rejects a day the calendar would roll over', () => {
    expect(parseDateKey('2026-02-31')).toBeNull();
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('2026-00-10')).toBeNull();
    expect(parseDateKey('2026-04-00')).toBeNull();
  });

  it('accepts a real leap day and rejects a fake one', () => {
    expect(parseDateKey('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseDateKey('2026-02-29')).toBeNull();
  });

  it('rejects non date-only and non-string input', () => {
    expect(parseDateKey('30-09-2026')).toBeNull();
    expect(parseDateKey('2026-09-30T00:00:00Z')).toBeNull();
    expect(parseDateKey('')).toBeNull();
    expect(parseDateKey(null)).toBeNull();
    expect(parseDateKey(undefined)).toBeNull();
  });
});

describe('weekday helpers', () => {
  it('maps ISO weekday codes Monday-first, matching Shift.weekdays', () => {
    expect(isoWeekdayCode({ year: 2026, month: 9, day: 28 })).toBe('MON');
    expect(isoWeekdayCode({ year: 2026, month: 9, day: 30 })).toBe('WED');
    expect(isoWeekdayCode({ year: 2026, month: 10, day: 4 })).toBe('SUN');
  });

  it('names weekdays locale-independently', () => {
    expect(isoWeekdayName({ year: 2026, month: 9, day: 26 })).toBe('Saturday');
    expect(isoWeekdayName({ year: 2026, month: 10, day: 5 })).toBe('Monday');
  });

  it('detects weekends', () => {
    expect(isWeekendDate({ year: 2026, month: 9, day: 26 })).toBe(true);
    expect(isWeekendDate({ year: 2026, month: 9, day: 27 })).toBe(true);
    expect(isWeekendDate({ year: 2026, month: 9, day: 28 })).toBe(false);
  });
});

describe('inclusiveDayCount', () => {
  it('counts both endpoints', () => {
    expect(inclusiveDayCount({ year: 2026, month: 9, day: 1 }, { year: 2026, month: 9, day: 1 })).toBe(1);
    expect(inclusiveDayCount({ year: 2026, month: 9, day: 1 }, { year: 2026, month: 9, day: 30 })).toBe(30);
  });

  it('spans a month and a year boundary', () => {
    expect(inclusiveDayCount({ year: 2026, month: 12, day: 30 }, { year: 2027, month: 1, day: 2 })).toBe(4);
  });
});

describe('resolveNonComplianceRange', () => {
  it('defaults to today alone', () => {
    const result = resolveNonComplianceRange(undefined, undefined, TODAY);
    expect(result).toEqual({
      ok: true,
      start: TODAY,
      end: TODAY,
      days: 1,
      clampedToToday: false,
    });
  });

  it('treats a start date with no end date as that single day', () => {
    const result = resolveNonComplianceRange('2026-09-01', undefined, TODAY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days).toBe(1);
    expect(result.start).toEqual({ year: 2026, month: 9, day: 1 });
    expect(result.end).toEqual({ year: 2026, month: 9, day: 1 });
  });

  it('clamps a future end date back to today', () => {
    const result = resolveNonComplianceRange('2026-09-28', '2026-12-31', TODAY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.clampedToToday).toBe(true);
    expect(result.end).toEqual(TODAY);
  });

  it('rejects a start date in the future when no end date is given', () => {
    const result = resolveNonComplianceRange('2026-10-05', undefined, TODAY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('START_IN_FUTURE');
  });

  it('rejects an end date before the start date', () => {
    const result = resolveNonComplianceRange('2026-09-20', '2026-09-10', TODAY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('END_BEFORE_START');
  });

  it('rejects malformed dates by name', () => {
    const start = resolveNonComplianceRange('not-a-date', undefined, TODAY);
    expect(start.ok).toBe(false);
    if (start.ok) return;
    expect(start.reason).toBe('INVALID_DATE');
    expect(start.message).toContain('startDate');

    const end = resolveNonComplianceRange('2026-09-01', '2026-02-31', TODAY);
    expect(end.ok).toBe(false);
    if (end.ok) return;
    expect(end.reason).toBe('INVALID_DATE');
    expect(end.message).toContain('endDate');
  });

  it('caps the range at a quarter', () => {
    const atLimit = resolveNonComplianceRange(
      '2026-07-01',
      '2026-09-30',
      TODAY,
    );
    expect(atLimit.ok).toBe(true);
    if (!atLimit.ok) return;
    expect(atLimit.days).toBe(92);
    expect(atLimit.days).toBeLessThanOrEqual(MAX_NON_COMPLIANCE_RANGE_DAYS);

    const tooWide = resolveNonComplianceRange('2026-01-01', '2026-09-30', TODAY);
    expect(tooWide.ok).toBe(false);
    if (tooWide.ok) return;
    expect(tooWide.reason).toBe('RANGE_TOO_LARGE');
  });
});

describe('toDateKey', () => {
  it('zero-pads month and day', () => {
    expect(toDateKey({ year: 2026, month: 1, day: 5 })).toBe('2026-01-05');
  });

  it('round-trips through parseDateKey', () => {
    const key = '2026-09-30';
    expect(toDateKey(parseDateKey(key)!)).toBe(key);
  });
});
