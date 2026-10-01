// A user's visible state comes from three independent columns — employmentStatus,
// isActive (login gate) and failedAttempts (lockout). Showing them as separate
// badges produced contradictions like "ACTIVE" next to "Inactive", so they are
// collapsed here into exactly one status. Shared by every user list so the
// directory and the admin console can't disagree.

export type EmploymentStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'RESIGNED' | 'TERMINATED';

export type EffectiveUserStatus = EmploymentStatus | 'LOCKED';

/** Mirrors the lockout threshold in backend/src/auth/auth.service.ts. */
export const LOCK_THRESHOLD = 5;

export interface UserStatusInput {
  employmentStatus?: string | null;
  isActive?: boolean | null;
  failedAttempts?: number | null;
}

/**
 * Precedence, highest first:
 *  1. DRAFT / RESIGNED / TERMINATED — these describe the employment itself, so
 *     they outrank any login state.
 *  2. LOCKED — a lockout is the thing an admin has to act on, so it must not be
 *     hidden behind a plain "inactive".
 *  3. INACTIVE — either the employment status says so, or login is switched off.
 *  4. ACTIVE.
 */
export function effectiveUserStatus(user: UserStatusInput): EffectiveUserStatus {
  const employment = (user.employmentStatus ?? 'ACTIVE') as EmploymentStatus;

  if (employment === 'DRAFT' || employment === 'RESIGNED' || employment === 'TERMINATED') {
    return employment;
  }

  // Based on failedAttempts alone: auth rejects a locked account regardless of
  // the isActive flag, so requiring both would under-report lockouts.
  if ((user.failedAttempts ?? 0) >= LOCK_THRESHOLD) return 'LOCKED';

  if (user.isActive === false || employment === 'INACTIVE') return 'INACTIVE';

  return 'ACTIVE';
}

export interface UserStatusCounts {
  total: number;
  active: number;
  inactive: number;
  locked: number;
  exited: number;
}

/**
 * Buckets every user into exactly one count, so
 * active + inactive + locked + exited === total always holds.
 * DRAFT counts as inactive — not yet activated is not yet active.
 */
export function summariseUserStatuses(users: UserStatusInput[]): UserStatusCounts {
  const counts: UserStatusCounts = { total: users.length, active: 0, inactive: 0, locked: 0, exited: 0 };

  for (const user of users) {
    switch (effectiveUserStatus(user)) {
      case 'ACTIVE': counts.active++; break;
      case 'LOCKED': counts.locked++; break;
      case 'RESIGNED':
      case 'TERMINATED': counts.exited++; break;
      case 'INACTIVE':
      case 'DRAFT': counts.inactive++; break;
    }
  }

  return counts;
}
