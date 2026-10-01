'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';

interface RoleGuardProps {
  children: React.ReactNode;
  /** Redirect to /dashboard if user's role is not in this list */
  allowedRoles?: string[];
  /** Redirect to /dashboard if user lacks ALL of these permissions */
  allowedPermissions?: string[];
  /** When true, user must have ALL permissions; when false (default), ANY permission suffices */
  requireAll?: boolean;
}

export function RoleGuard({
  children,
  allowedRoles,
  allowedPermissions,
  requireAll = false,
}: RoleGuardProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const roleOk =
    !allowedRoles || allowedRoles.length === 0 || (user ? allowedRoles.includes(user.role) : false);

  const permOk =
    !allowedPermissions ||
    allowedPermissions.length === 0 ||
    (user
      ? requireAll
        ? allowedPermissions.every((p) => user.permissions?.includes(p))
        : allowedPermissions.some((p) => user.permissions?.includes(p))
      : false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!roleOk || !permOk) {
      router.push('/dashboard');
    }
  }, [hasHydrated, user, roleOk, permOk, router]);

  if (!hasHydrated || !user || !roleOk || !permOk) return null;

  return <>{children}</>;
}
