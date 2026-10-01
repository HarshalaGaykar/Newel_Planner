'use client';

import { usePermission } from '@/lib/hooks/usePermission';

interface PermissionGateProps {
  /** Show children only if user has this permission */
  permission?: string;
  /** Show children only if user has any of these permissions */
  anyPermission?: string[];
  /** Show children only if user has all of these permissions */
  allPermissions?: string[];
  /** Show children only if user has this role */
  role?: string;
  /** Content to render if the check fails (defaults to null) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's
 * permissions or role. Does NOT redirect — use RoleGuard for that.
 *
 * @example
 *   <PermissionGate permission="USER_DELETE">
 *     <DeleteButton />
 *   </PermissionGate>
 *
 *   <PermissionGate anyPermission={['USER_CREATE', 'USER_UPDATE']}>
 *     <EditButton />
 *   </PermissionGate>
 */
export function PermissionGate({
  permission,
  anyPermission,
  allPermissions,
  role,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, canAll, is } = usePermission();

  const allowed =
    (!permission || can(permission)) &&
    (!anyPermission || anyPermission.length === 0 || canAny(...anyPermission)) &&
    (!allPermissions || allPermissions.length === 0 || canAll(...allPermissions)) &&
    (!role || is(role));

  return allowed ? <>{children}</> : <>{fallback}</>;
}
