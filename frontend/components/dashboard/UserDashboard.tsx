'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { operationsApi } from '@/lib/operations-api';
import { attendanceStatusLabel } from '@/lib/attendance-status';
import { useAuthStore } from '@/lib/store/auth';
import { useProjectStore } from '@/lib/store/project';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronRight,
  ExternalLink,
  Loader2,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/projects-api';
import type { Attendance } from '@/lib/operations-api';

/** Shape of `GET /dashboard/user`, narrowed to the fields this view reads. */
interface DashboardTask {
  id: string;
  title: string;
  priority?: string;
  status?: string;
  endDate?: string | null;
  project?: { name?: string } | null;
}

interface DashboardAllocation {
  id: string;
  startDate?: string | null;
  endDate?: string | null;
  project?: Project | null;
}

interface DashboardLeaveBalance {
  type: string;
  available: number;
}

interface UserDashboardData {
  todayAttendance?: Attendance | null;
  myTimesheetStatus?: { thisWeek?: string | null; lastWeek?: string | null } | null;
  myTasks?: DashboardTask[];
  leaveBalance?: DashboardLeaveBalance[];
  myAllocations?: DashboardAllocation[];
}

function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Timesheet workflow states, each with an explicit dark step. */
const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground ring-border',
  SUBMITTED: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/20',
  RA_APPROVED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-400/20',
  PM_APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  REJECTED: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
};

const MISSING_BADGE =
  'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20';

const PRIORITY_STYLES: Record<string, { text: string; dot: string }> = {
  CRITICAL: { text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  HIGH: { text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  MEDIUM: { text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  LOW: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
};

function titleCaseStatus(value: string) {
  return value
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

export default function UserDashboard() {
  const { user } = useAuthStore();
  const { setCurrentProject } = useProjectStore();
  const router = useRouter();
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<UserDashboardData>('/dashboard/user', { params: { timeZone: getBrowserTimeZone() } })
      .then((res) => {
        setData(res.data);
        setTodayAttendance(res.data.todayAttendance ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // Real-time sync when any surface checks in or out
  useEffect(() => {
    const handler = async () => {
      try {
        const updated = await operationsApi.getTodayAttendance(getBrowserTimeZone());
        setTodayAttendance(updated ?? null);
      } catch {}
    };
    window.addEventListener('attendance-updated', handler);
    return () => window.removeEventListener('attendance-updated', handler);
  }, []);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary/40" />
        <p className="text-xs text-muted-foreground">Loading your dashboard…</p>
      </div>
    );

  if (!data) return null;

  function viewProject(project: Project | null | undefined) {
    if (!project) return;
    setCurrentProject(project);
    router.push('/dashboard?view=project');
  }

  const today = todayAttendance;
  const tsThis = data.myTimesheetStatus?.thisWeek;
  const tsLast = data.myTimesheetStatus?.lastWeek;
  const tasks = data.myTasks ?? [];
  const leaveBalance = data.leaveBalance ?? [];
  const allocations = data.myAllocations ?? [];
  const now = new Date();
  const overdueTasks = tasks.filter((t) => t.endDate && new Date(t.endDate) < now);
  const dueTodayTasks = tasks.filter((t) => {
    if (!t.endDate) return false;
    const d = new Date(t.endDate);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const firstName = user?.email?.split('@')[0] ?? '';

  return (
    <div className="space-y-5">
      {/* ——— Header ——— */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <CalendarDays size={12} />
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ——— Status cards ——— */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Attendance */}
        <SummaryCard
          title="Today's Attendance"
          icon={<Clock size={13} />}
          tone="sky"
          onClick={() => router.push('/attendance')}
          ariaLabel="Open my attendance page"
        >
          {today?.checkIn ? (
            <>
              <p className="text-2xl font-semibold text-foreground tabular-nums tracking-tight leading-none">
                {formatTime(today.checkIn)}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {today.checkOut ? `Out at ${formatTime(today.checkOut)}` : 'Still checked in'}
                {today.isWfh ? ' · WFH' : ''}
              </p>
              {today.status && (
                <span className={cn('inline-flex items-center gap-1 mt-2.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1', statusChip(today.status))}>
                  {attendanceStatusLabel(today.status)}
                </span>
              )}
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold text-muted-foreground/40 tracking-tight leading-none">--:--</p>
              <p className="text-xs text-muted-foreground mt-1.5">Not checked in yet</p>
              <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-medium text-primary">
                Check in now <ChevronRight size={11} />
              </span>
            </>
          )}
        </SummaryCard>

        {/* Timesheet */}
        <SummaryCard
          title="This Week's Timesheet"
          icon={<Calendar size={13} />}
          tone="indigo"
          onClick={() => router.push('/timesheets')}
          ariaLabel="Open my timesheets page"
        >
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1',
              tsThis ? (STATUS_BADGE[tsThis] ?? STATUS_BADGE.DRAFT) : MISSING_BADGE,
            )}
          >
            {tsThis ? titleCaseStatus(tsThis) : 'Not submitted'}
          </span>
          <p className="text-xs text-muted-foreground mt-2.5">
            Last week:{' '}
            <span className={cn('font-medium', tsLast ? 'text-foreground' : 'text-red-600 dark:text-red-400')}>
              {tsLast ? titleCaseStatus(tsLast) : 'Missing'}
            </span>
          </p>
        </SummaryCard>

        {/* Tasks */}
        <SummaryCard
          title="Tasks Alert"
          icon={<AlertTriangle size={13} />}
          tone={overdueTasks.length > 0 ? 'red' : 'emerald'}
          onClick={() => router.push('/tasks')}
          ariaLabel="Open my tasks page"
        >
          <p className="text-2xl font-semibold text-foreground tabular-nums tracking-tight leading-none">
            {overdueTasks.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {overdueTasks.length === 1 ? 'overdue task' : 'overdue tasks'}
          </p>
          <p className={cn('text-xs mt-2.5 font-medium', dueTodayTasks.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
            {dueTodayTasks.length} due today
          </p>
        </SummaryCard>
      </div>

      {/* ——— Leave balances ——— */}
      {leaveBalance.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Leave Balance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {leaveBalance.map((lb) => (
              <div key={lb.type} className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{lb.type}</p>
                <p className="text-xl font-semibold text-foreground tabular-nums leading-tight mt-0.5">
                  {lb.available}
                </p>
                <p className="text-[11px] text-muted-foreground">days available</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ——— Tasks + allocations ——— */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className={cn(allocations.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12')}>
          <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <CheckCircle2 size={14} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">My Open Tasks</h3>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{tasks.length} total</span>
            </div>

            {tasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <CheckCircle2 size={16} />
                </div>
                <p className="text-xs text-muted-foreground">All caught up — no open tasks.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {tasks.slice(0, 8).map((task) => {
                    const isOverdue = task.endDate && new Date(task.endDate) < now;
                    const priority = PRIORITY_STYLES[task.priority ?? 'LOW'] ?? PRIORITY_STYLES.LOW;
                    return (
                      <button
                        key={task.id}
                        onClick={() => router.push('/tasks')}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left"
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', priority.dot)} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            <span className={priority.text}>{titleCaseStatus(task.priority ?? 'LOW')}</span>
                            {task.project?.name ? ` · ${task.project.name}` : ''}
                          </p>
                        </div>
                        {isOverdue && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20 shrink-0">
                            Overdue
                          </span>
                        )}
                        <span className="hidden sm:inline text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded shrink-0">
                          {titleCaseStatus(task.status ?? '')}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {tasks.length > 8 && (
                  <button
                    onClick={() => router.push('/tasks')}
                    className="px-4 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-muted/40 transition-colors flex items-center justify-center gap-1 rounded-b-xl"
                  >
                    View all {tasks.length} tasks <ChevronRight size={12} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {allocations.length > 0 && (
          <div className="lg:col-span-5">
            <div className="bg-card border border-border rounded-xl shadow-sm">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Active Allocations</h3>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {allocations.length} {allocations.length === 1 ? 'project' : 'projects'}
                </span>
              </div>
              <div className="p-4 space-y-3">
                {allocations.map((a) => (
                  <div key={a.id} className="flex justify-between items-center gap-2">
                    <button
                      onClick={() => viewProject(a.project)}
                      className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors group min-w-0"
                    >
                      <span className="truncate">{a.project?.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                    {a.startDate && a.endDate && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {new Date(a.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(a.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function statusChip(status: string) {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20';
    case 'LATE':
      return 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20';
    case 'ABSENT':
      return 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20';
    default:
      return 'bg-muted text-muted-foreground ring-border';
  }
}

const CARD_TONES: Record<string, { bar: string; icon: string }> = {
  sky: { bar: 'bg-sky-500', icon: 'text-sky-600 dark:text-sky-400' },
  indigo: { bar: 'bg-indigo-500', icon: 'text-indigo-600 dark:text-indigo-400' },
  red: { bar: 'bg-red-500', icon: 'text-red-600 dark:text-red-400' },
  emerald: { bar: 'bg-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400' },
};

function SummaryCard({
  title,
  icon,
  tone,
  onClick,
  ariaLabel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: keyof typeof CARD_TONES;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const t = CARD_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="group relative bg-card border border-border rounded-xl shadow-sm text-left p-4 pl-5 overflow-hidden hover:bg-muted/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
    >
      <span className={cn('absolute left-0 top-0 bottom-0 w-1', t.bar)} aria-hidden="true" />
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className={t.icon}>{icon}</span>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <ChevronRight
          size={13}
          className="ml-auto text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all"
        />
      </div>
      {children}
    </button>
  );
}
