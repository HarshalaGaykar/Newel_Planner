/**
 * Rules for work that hangs under a parent task (subtasks). Pure functions so
 * the service (which does the Prisma I/O) and the unit tests (no database)
 * share one definition of "effective effort" and of the parent's effort ceiling.
 *
 * A task's effective effort is its `estimatedEffort`, falling back to
 * `plannedHours` — the same chain the daily-effort derivation uses, so subtasks
 * created through the task dialogs and through the WBS importer are measured
 * against the same ceiling.
 */

/** Effort a task counts for: the estimate, else the WBS plan hours. */
export function resolveEffortHours(
  task:
    | { estimatedEffort?: number | null; plannedHours?: number | null }
    | null
    | undefined,
): number | null {
  if (!task) return null;
  const estimated = Number(task.estimatedEffort);
  if (Number.isFinite(estimated) && estimated > 0) return estimated;
  const planned = Number(task.plannedHours);
  if (Number.isFinite(planned) && planned > 0) return planned;
  return null;
}

/** Sum of a set of tasks' effective effort; un-estimated tasks count as zero. */
export function sumEffortHours(
  tasks: { estimatedEffort?: number | null; plannedHours?: number | null }[],
): number {
  return tasks.reduce<number>(
    (sum, task) => sum + (resolveEffortHours(task) ?? 0),
    0,
  );
}

// Effort lives in Float columns, so totals that should be equal can differ in
// their last bits (0.1 + 0.2 !== 0.3). Compare with a tolerance instead of a
// bare `>`, otherwise a subtask that exactly fills its parent gets rejected.
const EPSILON = 1e-6;

export interface EffortCeilingResult {
  /** No ceiling applies — the parent has no effort of its own. */
  applicable: boolean;
  over: boolean;
  ceiling: number | null;
  siblingTotal: number;
  total: number;
}

/**
 * Check a subtask's effort against its parent: the subtasks together may not
 * estimate more than the parent task. `siblingTotal` must exclude the subtask
 * being saved — pass its own resulting value as `incomingEffort` (use 0/null
 * when the subtask is being left un-estimated).
 */
export function checkSubtaskEffortCeiling(input: {
  parentEffort: number | null | undefined;
  siblingTotal: number;
  incomingEffort: number | null | undefined;
}): EffortCeilingResult {
  const parent = Number(input.parentEffort);
  const ceiling = Number.isFinite(parent) && parent > 0 ? parent : null;
  const siblings = Number(input.siblingTotal);
  const siblingTotal = Number.isFinite(siblings) && siblings > 0 ? siblings : 0;
  const incoming = Number(input.incomingEffort);
  const total =
    siblingTotal + (Number.isFinite(incoming) && incoming > 0 ? incoming : 0);

  if (ceiling === null) {
    return {
      applicable: false,
      over: false,
      ceiling: null,
      siblingTotal,
      total,
    };
  }
  return {
    applicable: true,
    over: total - ceiling > EPSILON,
    ceiling,
    siblingTotal,
    total,
  };
}

/** Hours for error messages: "100", never "100.00000000000001". */
export function formatHours(value: number): string {
  return String(Math.round(value * 100) / 100);
}
