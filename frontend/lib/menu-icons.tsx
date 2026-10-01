import { createElement, type ComponentType, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Briefcase,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock,
  FolderKanban,
  GraduationCap,
  Inbox,
  IndianRupee,
  Layers,
  Layout,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Milestone,
  Monitor,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { cn } from '@/lib/utils';

type MenuIconComponent = ComponentType<{ className?: string }>;

export const MENU_ICON_OPTIONS = [
  { value: 'LayoutDashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'FolderKanban', label: 'Projects', icon: FolderKanban },
  { value: 'ClipboardList', label: 'Work / Tasks', icon: ClipboardList },
  { value: 'Users', label: 'Users / Workforce', icon: Users },
  { value: 'Clock', label: 'Time / Attendance', icon: Clock },
  { value: 'Wallet', label: 'Finance', icon: Wallet },
  { value: 'IndianRupee', label: 'Rupee / Billing', icon: IndianRupee },
  { value: 'TrendingUp', label: 'Reports / Growth', icon: TrendingUp },
  { value: 'Settings', label: 'Administration', icon: Settings },
  { value: 'Layers', label: 'Learning / Layers', icon: Layers },
  { value: 'GraduationCap', label: 'Training', icon: GraduationCap },
  { value: 'Inbox', label: 'Inbox / Demands', icon: Inbox },
  { value: 'ChartNoAxesCombined', label: 'Analytics', icon: ChartNoAxesCombined },
  { value: 'BarChart3', label: 'Charts', icon: BarChart3 },
  { value: 'Target', label: 'Target', icon: Target },
  { value: 'Briefcase', label: 'Business', icon: Briefcase },
  { value: 'ShieldCheck', label: 'Permissions', icon: ShieldCheck },
  { value: 'BrainCircuit', label: 'AI Insights', icon: BrainCircuit },
  { value: 'Monitor', label: 'System / Device', icon: Monitor },
  { value: 'Building2', label: 'Company / Client', icon: Building2 },
  { value: 'MapPin', label: 'Location', icon: MapPin },
  { value: 'Ticket', label: 'Tickets', icon: Ticket },
  { value: 'Milestone', label: 'Milestones', icon: Milestone },
  { value: 'Activity', label: 'Activity', icon: Activity },
  { value: 'ShieldAlert', label: 'Alerts', icon: ShieldAlert },
] as const;

export const MENU_ICON_COMPONENTS: Record<string, MenuIconComponent> = {
  '\u{1F3E0}': LayoutDashboard,
  '\u{1F4C1}': FolderKanban,
  '\u23F1\uFE0F': Clock,
  '\u{1F334}': CalendarDays,
  '\u{1F4B0}': IndianRupee,
  '\u{1F465}': Users,
  '\u2699\uFE0F': Settings,
  '\u{1F9D1}\u200D\u{1F4BC}': Users,
  '\u{1F4CA}': LayoutDashboard,
  '\u{1F4BC}': Briefcase,
  '\u{1F4DA}': Layers,
  '\u{1F4CB}': ListTodo,
  '\u{1F3F3}\uFE0F': Milestone,
  '\u{1F3AB}': Ticket,
  '\u{1F4C9}': Activity,
  '\u{1F6A8}': ShieldAlert,
  '\u{1FA84}': BrainCircuit,
  '\u{1F4E5}': Inbox,
  '\u{1F4C8}': TrendingUp,
  '\u{1F4BB}': Monitor,
  '\u{1F3E2}': Building2,
  '\u{1F4CD}': MapPin,
  Activity,
  BarChart3,
  BrainCircuit,
  Briefcase,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock,
  FolderKanban,
  GraduationCap,
  Inbox,
  IndianRupee,
  Layers,
  Layout,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Milestone,
  Monitor,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
};

export function getMenuIconComponent(icon: string | null | undefined) {
  return icon ? MENU_ICON_COMPONENTS[icon] : undefined;
}

export function MenuIcon({
  icon,
  className,
  fallback,
}: {
  icon: string | null | undefined;
  className?: string;
  fallback?: ReactNode;
}) {
  const Icon = getMenuIconComponent(icon);

  if (Icon) {
    return createElement(Icon, { className: cn('h-4 w-4 shrink-0', className) });
  }

  if (icon && !/^[A-Za-z][A-Za-z0-9]+$/.test(icon)) {
    return (
      <span className={cn('shrink-0 text-center text-sm leading-none', className)}>
        {icon}
      </span>
    );
  }

  return fallback ?? <Layout className={cn('h-4 w-4 shrink-0', className)} />;
}
