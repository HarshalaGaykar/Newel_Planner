import {
  countWorkingDays,
  deriveDailyEffort,
  toDateKey,
} from './daily-effort.util';

const d = (iso: string) => new Date(iso);
const NO_HOLIDAYS = new Set<string>();

describe('countWorkingDays', () => {
  it('counts Mon–Fri inclusively', () => {
    // 2026-06-01 (Mon) → 2026-06-05 (Fri)
    expect(
      countWorkingDays(d('2026-06-01'), d('2026-06-05'), NO_HOLIDAYS),
    ).toBe(5);
  });

  it('excludes weekends', () => {
    // Fri 2026-06-05 → Mon 2026-06-08 spans a weekend
    expect(
      countWorkingDays(d('2026-06-05'), d('2026-06-08'), NO_HOLIDAYS),
    ).toBe(2);
  });

  it('excludes holidays from the count', () => {
    const holidays = new Set(['2026-06-03']);
    expect(countWorkingDays(d('2026-06-01'), d('2026-06-05'), holidays)).toBe(
      4,
    );
  });

  it('returns 0 for a weekend-only window', () => {
    expect(
      countWorkingDays(d('2026-06-06'), d('2026-06-07'), NO_HOLIDAYS),
    ).toBe(0);
  });

  it('returns 0 when end is before start', () => {
    expect(
      countWorkingDays(d('2026-06-05'), d('2026-06-01'), NO_HOLIDAYS),
    ).toBe(0);
  });
});

describe('deriveDailyEffort', () => {
  it('spreads effort across working days and rounds to one decimal', () => {
    // 10 working days → exactly 10 h/day
    expect(
      deriveDailyEffort(100, d('2026-06-01'), d('2026-06-12'), NO_HOLIDAYS),
    ).toEqual({
      dailyEffort: 10,
      workingDays: 10,
    });
  });

  it('is holiday-aware', () => {
    const holidays = new Set(['2026-06-03']);
    // 9 working days once the holiday is removed → 121 / 9 ≈ 13.4
    expect(
      deriveDailyEffort(121, d('2026-06-01'), d('2026-06-12'), holidays),
    ).toEqual({
      dailyEffort: 13.4,
      workingDays: 9,
    });
  });

  it('clamps a weekend-only span to a single day', () => {
    expect(
      deriveDailyEffort(8, d('2026-06-06'), d('2026-06-07'), NO_HOLIDAYS),
    ).toEqual({
      dailyEffort: 8,
      workingDays: 1,
    });
  });

  it('returns null without a positive effort', () => {
    expect(
      deriveDailyEffort(0, d('2026-06-01'), d('2026-06-05'), NO_HOLIDAYS),
    ).toBeNull();
    expect(
      deriveDailyEffort(null, d('2026-06-01'), d('2026-06-05'), NO_HOLIDAYS),
    ).toBeNull();
  });

  it('returns null without a full date pair', () => {
    expect(deriveDailyEffort(8, d('2026-06-01'), null, NO_HOLIDAYS)).toBeNull();
    expect(deriveDailyEffort(8, null, null, NO_HOLIDAYS)).toBeNull();
  });

  it('returns null for an invalid date', () => {
    expect(
      deriveDailyEffort(8, new Date('nope'), d('2026-06-05'), NO_HOLIDAYS),
    ).toBeNull();
  });
});

describe('toDateKey', () => {
  it('formats as YYYY-MM-DD in UTC', () => {
    expect(toDateKey(new Date('2026-06-01T00:00:00.000Z'))).toBe('2026-06-01');
  });
});
