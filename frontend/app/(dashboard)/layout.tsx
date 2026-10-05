'use client';

import { DynamicSidebar } from '@/components/layout/DynamicSidebar';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { WhatsNewNavButton } from '@/components/whats-new/WhatsNewNavButton';
import { ClockWidget } from '@/components/layout/ClockWidget';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { useAuthStore } from '@/lib/store/auth';
import { X, Menu } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

function TopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { user } = useAuthStore();

  return (
    <header className="h-14 md:h-16 shrink-0 border-b border-border bg-card flex items-center justify-between px-4 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuOpen}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <ClockWidget />
        <div className="hidden sm:block h-4 w-px bg-border/60" />
        <AnimatedThemeToggler variant="star" />
        <WhatsNewNavButton />
        <NotificationBell />

        {user && <div className="hidden sm:block h-4 w-px bg-border/60" />}

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-foreground leading-tight">
                {user.email.split('@')[0]}
              </span>
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <Link
              href="/profile"
              className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary hover:ring-2 hover:ring-primary/30 transition-all"
            >
              {user.email.substring(0, 1).toUpperCase()}
            </Link>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {user.role}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop: always visible and expanded */}
      <aside className="hidden lg:flex flex-col shrink-0 border-r border-border bg-card lg:w-64 xl:w-72">
        <DynamicSidebar isCollapsed={false} />
      </aside>

      {/* Sidebar - Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[300px] bg-card border-r shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 z-10 p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
            <DynamicSidebar isCollapsed={false} onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative">
        <TopBar onMenuOpen={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar">
          <div className="p-3 md:p-4 lg:p-5">
            <div className="max-w-screen-2xl mx-auto w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
