/**
 * Estimate-vs-logged maths for the timesheet over-run warning.
 *
 * The estimate a task is measured against is `plannedHours ?? estimatedEffort` —
 * the same rule the TL dashboard Gantt already uses to badge a task
 * Within / Over / Unestimated, so the warning here and the badge on the
 * dashboard can never disagree. `loggedHours` is the sum of every
 * TimesheetEntry row against the task (all time, not just this week): the
 * estimate covers the whole task, so the warning has to as well.
 *
 * Pure functions — the service does the Prisma I/O, the tests need no database.
 */

export type WithinEstimate = 'WITHIN' | 'OVER' | 'UNESTIMATED';

export interface EffortStatus {
  /** False when the task carries no estimate — nothing to compare against. */
  applicable: boolean;
  withinEstimate: WithinEstimate;
  estimateHours: number | null;
  loggedHours: number;
  /** loggedHours + the entry being added/edited. */
  projectedHours: number;
  /** How far the projected total sits above the estimate (0 when within). */
  overByHours: number;
  /** Estimate still available (negative once the task is over). */
  remainingHours: number | null;
  /** Ready-to-render sentence, or null when there is nothing to warn about. */
  warning: string | null;
}

/** The estimate a task counts for: WBS plan hours first, then the task estimate. */
export function resolveEstimateHours(
  task:
    | { plannedHours?: number | null; estimatedEffort?: number | null }
    | null
    | undefined,
): number | null {
  if (!task) return null;
  const planned = Number(task.plannedHours);
  if (Number.isFinite(planned) && planned > 0) return planned;
  const estimated = Number(task.estimatedEffort);
  if (Number.isFinite(estimated) && estimated > 0) return estimated;
  return null;
}

/** Hours for user-facing text: "8", never "8.000000000000002". */
export function formatHours(value: number): string {
  return String(Math.round(value * 10) / 10);
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Compare what has been logged against what was estimated, projecting the entry
 * about to be saved. The warning fires only when this entry takes the task over
 * the estimate — a task that is already over from earlier weeks gets flagged
 * too, because the user is adding to it right now (with `overByHours` telling
 * them by how much).
 */
export function buildEffortStatus(input: {
  taskTitle?: string | null;
  estimateHours: number | null | undefined;
  loggedHours: number;
  incomingHours?: number | null;
}): EffortStatus {
  const estimate = Number(input.estimateHours);
  const hasEstimate =
    Number.isFinite(estimate) && estimate > 0 ? estimate : null;
  const loggedRaw = Number(input.loggedHours);
  const logged = Number.isFinite(loggedRaw) && loggedRaw > 0 ? loggedRaw : 0;
  const incomingRaw = Number(input.incomingHours);
  const incoming =
    Number.isFinite(incomingRaw) && incomingRaw > 0 ? incomingRaw : 0;
  const projected = round1(logged + incoming);

  if (hasEstimate === null) {
    return {
      applicable: false,
      withinEstimate: 'UNESTIMATED',
      estimateHours: null,
      loggedHours: round1(logged),
      projectedHours: projected,
      overByHours: 0,
      remainingHours: null,
      warning: null,
    };
  }

  const over = round1(projected - hasEstimate);
  const withinEstimate: WithinEstimate = over > 1e-6 ? 'OVER' : 'WITHIN';
  const title = input.taskTitle?.trim()
    ? `“${input.taskTitle.trim()}”`
    : 'this task';

  return {
    applicable: true,
    withinEstimate,
    estimateHours: round1(hasEstimate),
    loggedHours: round1(logged),
    projectedHours: projected,
    overByHours: over > 0 ? over : 0,
    remainingHours: round1(hasEstimate - logged),
    warning:
      withinEstimate === 'OVER'
        ? `${formatHours(logged)}h already logged against ${title}, which was estimated at ` +
          `${formatHours(hasEstimate)}h. This entry takes it to ${formatHours(projected)}h — ` +
          `${formatHours(over)}h over estimate.`
        : null,
  };
}
