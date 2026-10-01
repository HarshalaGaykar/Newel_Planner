'use client';

import { ReactNode } from 'react';
import { usePermission } from '@/lib/hooks/usePermission';

interface PermissionGuardProps {
  /** Permission string required to view children */
  permission?: string;
  /** List of permissions - user must have ANY of these */
  any?: string[];
  /** List of permissions - user must have ALL of these */
  all?: string[];
  /** Role string required to view children */
  role?: string;
  /** When true, a Reporting Authority is granted access regardless of the above checks */
  allowReportingAuthority?: boolean;
  /** Component to show if user doesn't have permission */
  fallback?: ReactNode;
  /** Children to render if permission is granted */
  children: ReactNode;
}

/**
 * PermissionGuard allows for conditional rendering of UI elements
 * based on the current user's permissions and roles.
 */
export function PermissionGuard({
  permission,
  any,
  all,
  role,
  allowReportingAuthority,
  fallback = null,
  children
}: PermissionGuardProps) {
  const { can, canAny, canAll, is, user } = usePermission();

  let hasAccess = true;

  if (permission && !can(permission)) {
    hasAccess = false;
  }

  if (any && !canAny(...any)) {
    hasAccess = false;
  }

  if (all && !canAll(...all)) {
    hasAccess = false;
  }

  if (role && !is(role)) {
    hasAccess = false;
  }

  // Reporting Authorities are allowed through even without the listed permission/role.
  if (!hasAccess && allowReportingAuthority && user?.isReportingAuthority) {
    hasAccess = true;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
