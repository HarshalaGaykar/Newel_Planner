'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar, SidebarBody, useSidebar } from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/lib/store/auth';
import { useProjectStore } from '@/lib/store/project';
import { ProjectType, type Project } from '@/lib/projects-api';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BrainCircuit,
  Briefcase,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardList,
  Clock,
  FolderKanban,
  GraduationCap,
  Inbox,
  IndianRupee,
  Layers,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
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

import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface MenuNode {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  order: number;
  parentId: string | null;
  children: MenuNode[];
}

type SidebarIcon = ComponentType<{ className?: string }>;

const EXPANDED_GROUPS_STORAGE_KEY = 'aceternity-sidebar-expanded-groups';

const IconMap: Record<string, SidebarIcon> = {
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
  BarChart3,
  Briefcase,
  ChartNoAxesCombined,
  ClipboardList,
  FolderKanban,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Wallet,
};

function isActive(nodePath: string, pathname: string, exact = false): boolean {
  const cleanPath = nodePath.replace('_PROJECT', '');
  if (exact) return pathname === cleanPath;
  return pathname === cleanPath || pathname.startsWith(`${cleanPath}/`);
}

function hasActiveDescendant(node: MenuNode, pathname: string): boolean {
  return node.children.some(
    (child) => isActive(child.path, pathname) || hasActiveDescendant(child, pathname),
  );
}

function findAncestorIds(nodes: MenuNode[], pathname: string): string[] {
  const ids: string[] = [];

  function search(node: MenuNode): boolean {
    const childMatch = node.children.some((child) => search(child));

    if (childMatch || isActive(node.path, pathname)) {
      ids.push(node.id);
      return true;
    }

    return false;
  }

  nodes.forEach(search);
  return ids;
}

function readStoredExpandedIds(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value) => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistExpandedIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify([...ids]));
}

function resolveHref(node: MenuNode, currentProject: Project | null) {
  const rawPath = node.path.replace('_PROJECT', '');
  let finalHref = rawPath;

  if (node.path.endsWith('_PROJECT') && currentProject) {
    if (rawPath === '/dashboard') {
      finalHref = `/projects/${currentProject.id}?tab=dashboard`;
    } else if (rawPath === '/sprint') {
      finalHref = `/projects/${currentProject.id}?tab=tasks`;
    } else if (rawPath === '/milestones') {
      finalHref = `/projects/${currentProject.id}?tab=milestones`;
    } else if (rawPath === '/sla') {
      finalHref = `/projects/${currentProject.id}?tab=tickets&filter=sla`;
    } else if (rawPath === '/incidents') {
      finalHref = `/projects/${currentProject.id}?tab=tickets&filter=incident`;
    } else if (rawPath === '/tickets') {
      finalHref = `/projects/${currentProject.id}?tab=tickets`;
    }
  }

  return finalHref;
}

function filterMenuTree(nodes: MenuNode[], currentProject: Project | null): MenuNode[] {
  return nodes
    .filter((node) => {
      if (currentProject) {
        const isDev = currentProject.type === ProjectType.DEVELOPMENT;

        if (isDev && ['Ticket Queue', 'SLA', 'Incident'].some((key) => node.name.includes(key))) {
          return false;
        }

        if (!isDev && ['Sprint Board', 'Milestones'].some((key) => node.name.includes(key))) {
          return false;
        }
      } else if (
        ['Sprint Board', 'Ticket Queue', 'Milestones'].some((key) => node.name.includes(key))
      ) {
        return false;
      }

      return true;
    })
    .map((node) => ({
      ...node,
      children: filterMenuTree(node.children, currentProject),
    }));
}

function NodeIcon({
  icon,
  active,
}: {
  icon: string | null;
  active?: boolean;
}) {
  if (icon && IconMap[icon]) {
    const Icon = IconMap[icon];
    return <Icon className="h-[18px] w-[18px] shrink-0" />;
  }

  if (icon) {
    return <span className="w-[18px] shrink-0 text-center text-[15px] leading-none">{icon}</span>;
  }

  return (
    <span className="flex w-[18px] shrink-0 items-center justify-center">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          active ? 'bg-primary' : 'bg-muted-foreground/40',
        )}
      />
    </span>
  );
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  const { open, animate } = useSidebar();

  return (
    <motion.span
      animate={{
        display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
        opacity: animate ? (open ? 1 : 0) : 1,
      }}
      className="min-w-0 flex-1 truncate text-left"
    >
      {children}
    </motion.span>
  );
}

function SidebarChevron({ expanded, active }: { expanded: boolean; active: boolean }) {
  const { open, animate } = useSidebar();

  return (
    <motion.span
      animate={{
        display: animate ? (open ? 'inline-flex' : 'none') : 'inline-flex',
        opacity: animate ? (open ? 1 : 0) : 1,
      }}
      className="shrink-0"
    >
      <ChevronRight
        className={cn(
          'h-3.5 w-3.5 text-muted-foreground/60 transition-transform',
          expanded && 'rotate-90',
          active && 'text-primary',
        )}
      />
    </motion.span>
  );
}

interface NavItemProps {
  node: MenuNode;
  depth: number;
  pathname: string;
  currentProject: Project | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onNavigate?: () => void;
}

function NavItem({
  node,
  depth,
  pathname,
  currentProject,
  expandedIds,
  onToggle,
  onNavigate,
}: NavItemProps) {
  const { open } = useSidebar();
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const leafActive = !hasChildren && isActive(node.path, pathname, true);
  const parentActive =
    hasChildren && (isActive(node.path, pathname) || hasActiveDescendant(node, pathname));
  const active = leafActive || parentActive;

  const itemClassName = cn(
    'group/sidebar flex min-h-9 w-full items-center gap-2 rounded-md text-sm font-medium transition-colors',
    open ? 'px-3' : 'justify-center px-0',
    depth > 0 && open && 'text-[13px]',
    active
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
  );

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className={itemClassName}
          title={!open ? node.name : undefined}
        >
          <NodeIcon icon={node.icon} active={active} />
          <SidebarLabel>{node.name}</SidebarLabel>
          <SidebarChevron expanded={expanded} active={active} />
        </button>

        <AnimatePresence initial={false}>
          {open && expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className={cn('mt-1 space-y-0.5', depth === 0 ? 'pl-3' : 'pl-2')}>
                {node.children.map((child) => (
                  <NavItem
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    pathname={pathname}
                    currentProject={currentProject}
                    expandedIds={expandedIds}
                    onToggle={onToggle}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link
      href={resolveHref(node, currentProject)}
      prefetch={false}
      onClick={onNavigate}
      className={itemClassName}
      title={!open ? node.name : undefined}
    >
      <NodeIcon icon={node.icon} active={active} />
      <SidebarLabel>{node.name}</SidebarLabel>
    </Link>
  );
}

function NavSkeleton() {
  const { open } = useSidebar();

  if (!open) {
    return (
      <div className="space-y-2 px-2 py-2 animate-pulse">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="mx-auto h-8 w-8 rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 py-2 animate-pulse">
      {[100, 84, 92, 74, 88].map((width, index) => (
        <div key={index} className="h-9 rounded-md bg-muted" style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}

export function DynamicSidebar({
  isCollapsed = false,
  onNavigate,
}: {
  isCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { currentProject } = useProjectStore();

  const [menuTree, setMenuTree] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const fetchMenu = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);

      const { data } = await api.get<MenuNode[]>('/menu/my-menu');
      const activeAncestors = findAncestorIds(data, pathname);
      const nextExpandedIds = new Set([...readStoredExpandedIds(), ...activeAncestors]);

      setMenuTree(data);
      setExpandedIds(nextExpandedIds);
      persistExpandedIds(nextExpandedIds);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    if (menuTree.length === 0) return;

    const ancestors = findAncestorIds(menuTree, pathname);
    if (ancestors.length === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedIds((previousIds) => {
      const nextIds = new Set([...previousIds, ...ancestors]);
      persistExpandedIds(nextIds);
      return nextIds;
    });
  }, [pathname, menuTree]);

  function handleToggle(id: string) {
    setExpandedIds((previousIds) => {
      const nextIds = new Set(previousIds);

      if (nextIds.has(id)) {
        nextIds.delete(id);
      } else {
        nextIds.add(id);
      }

      persistExpandedIds(nextIds);
      return nextIds;
    });
  }

  function handleLogout() {
    setLogoutDialogOpen(false);
    logout();
    router.push('/login');
  }

  const filteredMenus = filterMenuTree(menuTree, currentProject);

  return (
    <Sidebar open={!isCollapsed} animate>
      <SidebarBody className="justify-between gap-4 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
          <div
            className={cn(
              'flex h-14 md:h-16 shrink-0 items-center border-b border-border transition-all duration-300',
              isCollapsed ? 'justify-center px-0' : 'px-4',
            )}
          >
            <div className={cn('flex min-w-0 items-center gap-2.5', isCollapsed && 'justify-center gap-0')}>
              <Image
                src="/newel-logo.png"
                alt="Newel Technologies"
                width={1016}
                height={640}
                priority
                className={cn(
                  'w-auto shrink-0 object-contain transition-all duration-300',
                  isCollapsed ? 'h-7' : 'h-8 md:h-9',
                )}
              />
              <SidebarLabel>
                <span className="block truncate text-sm font-bold leading-tight text-foreground">
                  Newel Technologies
                </span>
                <span className="block truncate text-[11px] font-medium uppercase tracking-wide leading-tight text-muted-foreground">
                  Planner
                </span>
              </SidebarLabel>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 custom-scrollbar">
            <div className={cn('space-y-1', isCollapsed ? 'px-2' : 'px-3')}>
              {loading ? (
                <NavSkeleton />
              ) : error ? (
                <div
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 py-8 text-center',
                    isCollapsed ? 'px-1' : 'px-4',
                  )}
                >
                  <AlertCircle className="h-5 w-5 text-destructive/60" />
                  {!isCollapsed && (
                    <>
                      <p className="text-xs text-muted-foreground">Failed to load navigation</p>
                      <button onClick={fetchMenu} className="text-xs text-primary hover:underline">
                        Retry
                      </button>
                    </>
                  )}
                </div>
              ) : (
                filteredMenus.map((node) => (
                  <NavItem
                    key={node.id}
                    node={node}
                    depth={0}
                    pathname={pathname}
                    currentProject={currentProject}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                    onNavigate={onNavigate}
                  />
                ))
              )}
            </div>
          </nav>
        </div>

        <div className="shrink-0 border-t border-border p-2">
          <button
            onClick={() => setLogoutDialogOpen(true)}
            className={cn(
              'flex min-h-9 w-full items-center gap-2 rounded-md text-sm font-medium text-destructive transition-colors hover:bg-destructive/10',
              isCollapsed ? 'justify-center px-0' : 'px-3',
            )}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <SidebarLabel>Logout</SidebarLabel>
          </button>
        </div>
      </SidebarBody>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be signed out of your account and returned to the login page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Yes, Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
