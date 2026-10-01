'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  ShieldCheck,
  History,
  FolderTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sidebarItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'USER'] },
  { name: 'User Management', href: '/users', icon: Users, roles: ['ADMIN'] },
  { name: 'Menu Management', href: '/menu', icon: FolderTree, roles: ['ADMIN'] },
  { name: 'Audit Logs', href: '/audit', icon: History, roles: ['ADMIN'] },
  { name: 'Permissions', href: '/permissions', icon: ShieldCheck, roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN', 'USER'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const filteredItems = sidebarItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  return (
    <div className="flex h-screen w-64 flex-col bg-card border-r border-border">
      <div className="flex h-16 items-center px-6">
        <span className="text-2xl font-bold premium-gradient bg-clip-text text-transparent">
          Newel Technologies PVT Ltd
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <button
          onClick={() => logout()}
          className="flex w-full items-center px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
