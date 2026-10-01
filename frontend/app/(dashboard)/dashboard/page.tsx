'use client';

import { useAuthStore } from '@/lib/store/auth';
import { useProjectStore } from '@/lib/store/project';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import UserDashboard from '@/components/dashboard/UserDashboard';
import TLDashboard from '@/components/dashboard/TLDashboard';
import HRDashboard from '@/components/dashboard/HRDashboard';
import ManagementDashboard from '@/components/dashboard/ManagementDashboard';
import DevelopmentDashboard from '@/components/dashboard/development/DevelopmentDashboard';
import MaintenanceDashboard from '@/components/dashboard/maintenance/MaintenanceDashboard';
import { ProjectType } from '@/lib/projects-api';
import { useSearchParams } from 'next/navigation';

// Roles that see org-level dashboards instead of project-scoped views
const ORG_LEVEL_ROLES = ['ADMIN', 'PM', 'TL', 'HR'];

function DashboardContent() {
  const { user, hasHydrated } = useAuthStore();
  const { currentProject } = useProjectStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');

  useEffect(() => {
    if (hasHydrated && !user) {
      router.push('/login');
    }
  }, [hasHydrated, user, router]);

  if (!hasHydrated || !user) return null;

  // Any role can drill into a project-specific view via ?view=project
  if (view === 'project' && currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
            {currentProject.name} Overview
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1.5">
            Real-time status and metrics for this project context.
          </p>
        </div>
        {currentProject.type === ProjectType.DEVELOPMENT ? (
          <DevelopmentDashboard project={currentProject} />
        ) : (
          <MaintenanceDashboard project={currentProject} />
        )}
      </div>
    );
  }

  // Default: each role gets their own org/personal dashboard
  if (user.role === 'ADMIN') return <ManagementDashboard />;
  if (user.role === 'PM') return <ManagementDashboard />;
  if (user.role === 'TL') return <TLDashboard />;
  if (user.role === 'HR') return <HRDashboard />;

  // USER and FREELANCER always get the personal cross-project dashboard
  return <UserDashboard />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
