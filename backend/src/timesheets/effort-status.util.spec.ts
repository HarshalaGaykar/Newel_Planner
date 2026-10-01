import {
  buildEffortStatus,
  formatHours,
  resolveEstimateHours,
} from './effort-status.util';

describe('resolveEstimateHours', () => {
  it('prefers WBS plan hours over the task estimate', () => {
    expect(resolveEstimateHours({ plannedHours: 40, estimatedEffort: 8 })).toBe(
      40,
    );
  });

  it('falls back to the task estimate when there are no plan hours', () => {
    expect(
      resolveEstimateHours({ plannedHours: null, estimatedEffort: 8 }),
    ).toBe(8);
    expect(resolveEstimateHours({ plannedHours: 0, estimatedEffort: 8 })).toBe(
      8,
    );
  });

  it('returns null for an unestimated task', () => {
    expect(
      resolveEstimateHours({ plannedHours: null, estimatedEffort: null }),
    ).toBeNull();
    expect(resolveEstimateHours(null)).toBeNull();
  });
});

describe('buildEffortStatus', () => {
  it('stays silent for an unestimated task', () => {
    const status = buildEffortStatus({
      estimateHours: null,
      loggedHours: 40,
      incomingHours: 4,
    });
    expect(status.applicable).toBe(false);
    expect(status.withinEstimate).toBe('UNESTIMATED');
    expect(status.warning).toBeNull();
  });

  it('does not warn while the entry keeps the task within estimate', () => {
    const status = buildEffortStatus({
      estimateHours: 40,
      loggedHours: 30,
      incomingHours: 4,
    });
    expect(status).toMatchObject({
      applicable: true,
      withinEstimate: 'WITHIN',
      estimateHours: 40,
      loggedHours: 30,
      projectedHours: 34,
      overByHours: 0,
      remainingHours: 10,
    });
    expect(status.warning).toBeNull();
  });

  it('warns when the entry takes the task over the estimate', () => {
    const status = buildEffortStatus({
      taskTitle: 'Login feature',
      estimateHours: 40,
      loggedHours: 38,
      incomingHours: 4,
    });
    expect(status.withinEstimate).toBe('OVER');
    expect(status.overByHours).toBe(2);
    expect(status.projectedHours).toBe(42);
    expect(status.warning).toContain('Login feature');
    expect(status.warning).toContain('2h over estimate');
  });

  it('warns on an already-over task the user is adding to', () => {
    const status = buildEffortStatus({
      estimateHours: 10,
      loggedHours: 14,
      incomingHours: 1,
    });
    expect(status.withinEstimate).toBe('OVER');
    expect(status.overByHours).toBe(5);
    expect(status.remainingHours).toBe(-4);
  });

  it('treats a missing or zero incoming value as no change', () => {
    const status = buildEffortStatus({
      estimateHours: 10,
      loggedHours: 10,
      incomingHours: undefined,
    });
    expect(status.withinEstimate).toBe('WITHIN');
    expect(status.projectedHours).toBe(10);
  });

  it('tolerates float noise at the boundary', () => {
    const status = buildEffortStatus({
      estimateHours: 0.3,
      loggedHours: 0.1,
      incomingHours: 0.2,
    });
    expect(status.withinEstimate).toBe('WITHIN');
  });

  it('quotes the task title in the message when there is one', () => {
    const status = buildEffortStatus({
      taskTitle: 'Task A',
      estimateHours: 1,
      loggedHours: 5,
      incomingHours: 1,
    });
    expect(status.warning).toContain('“Task A”');
  });
});

describe('formatHours', () => {
  it('rounds to one decimal for display', () => {
    expect(formatHours(0.1 + 0.2)).toBe('0.3');
    expect(formatHours(12.000000000000002)).toBe('12');
  });
});
