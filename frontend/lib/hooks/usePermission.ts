import { useAuthStore } from '@/lib/store/auth';

/**
 * Returns helpers to check whether the current user has specific
 * permissions or roles. Use this for conditional UI rendering.
 *
 * @example
 *   const { can, is } = usePermission();
 *   if (can('USER_DELETE')) { ... }
 *   if (is('ADMIN')) { ... }
 */
export function usePermission() {
  const user = useAuthStore((s) => s.user);

  function can(permission: string): boolean {
    return user?.permissions?.includes(permission) ?? false;
  }

  function canAny(...permissions: string[]): boolean {
    return permissions.some((p) => can(p));
  }

  function canAll(...permissions: string[]): boolean {
    return permissions.every((p) => can(p));
  }

  function is(role: string): boolean {
    return user?.role === role;
  }

  return { can, canAny, canAll, is, user };
}
