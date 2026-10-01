import {
  checkSubtaskEffortCeiling,
  formatHours,
  resolveEffortHours,
  sumEffortHours,
} from './subtask-rules.util';

describe('resolveEffortHours', () => {
  it('prefers the estimate over the WBS plan hours', () => {
    expect(resolveEffortHours({ estimatedEffort: 40, plannedHours: 100 })).toBe(
      40,
    );
  });

  it('falls back to plan hours when the estimate is missing or zero', () => {
    expect(
      resolveEffortHours({ estimatedEffort: null, plannedHours: 100 }),
    ).toBe(100);
    expect(resolveEffortHours({ estimatedEffort: 0, plannedHours: 100 })).toBe(
      100,
    );
  });

  it('returns null when there is no effort at all', () => {
    expect(
      resolveEffortHours({ estimatedEffort: null, plannedHours: null }),
    ).toBeNull();
    expect(
      resolveEffortHours({ estimatedEffort: 0, plannedHours: 0 }),
    ).toBeNull();
    expect(resolveEffortHours(null)).toBeNull();
  });
});

describe('sumEffortHours', () => {
  it('adds effective effort and ignores un-estimated tasks', () => {
    expect(
      sumEffortHours([
        { estimatedEffort: 40 },
        { estimatedEffort: null, plannedHours: 25 },
        { estimatedEffort: null, plannedHours: null },
      ]),
    ).toBe(65);
  });
});

describe('checkSubtaskEffortCeiling', () => {
  it('does not apply when the parent has no effort of its own', () => {
    const result = checkSubtaskEffortCeiling({
      parentEffort: null,
      siblingTotal: 500,
      incomingEffort: 500,
    });
    expect(result.applicable).toBe(false);
    expect(result.over).toBe(false);
  });

  it('allows a subtask set that stays under the parent', () => {
    const result = checkSubtaskEffortCeiling({
      parentEffort: 100,
      siblingTotal: 70,
      incomingEffort: 20,
    });
    expect(result).toMatchObject({
      applicable: true,
      over: false,
      ceiling: 100,
      siblingTotal: 70,
      total: 90,
    });
  });

  it('allows a subtask that exactly fills the parent (float tolerance)', () => {
    const result = checkSubtaskEffortCeiling({
      parentEffort: 0.3,
      siblingTotal: 0.1,
      incomingEffort: 0.2,
    });
    expect(result.over).toBe(false);
  });

  it('rejects a subtask that pushes the total past the parent', () => {
    const result = checkSubtaskEffortCeiling({
      parentEffort: 100,
      siblingTotal: 90,
      incomingEffort: 20,
    });
    expect(result).toMatchObject({
      over: true,
      ceiling: 100,
      siblingTotal: 90,
      total: 110,
    });
  });

  it('treats an un-estimated subtask as zero', () => {
    const result = checkSubtaskEffortCeiling({
      parentEffort: 100,
      siblingTotal: 100,
      incomingEffort: null,
    });
    expect(result.over).toBe(false);
    expect(result.total).toBe(100);
  });

  it('rejects a first subtask that is bigger than the parent on its own', () => {
    const result = checkSubtaskEffortCeiling({
      parentEffort: 50,
      siblingTotal: 0,
      incomingEffort: 51,
    });
    expect(result.over).toBe(true);
  });
});

describe('formatHours', () => {
  it('rounds float noise out of the message', () => {
    expect(formatHours(0.1 + 0.2)).toBe('0.3');
    expect(formatHours(110.00000000000001)).toBe('110');
  });
});
