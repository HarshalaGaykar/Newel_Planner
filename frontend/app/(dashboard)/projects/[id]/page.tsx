'use client';

import { Suspense, useEffect, useState, useCallback, useId, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Plus, Pencil, Trash2, X, Check,
  ListTodo, Ticket as TicketIcon, Milestone, Users, CheckCircle2, Clock, AlertCircle,
  LayoutDashboard, TrendingUp, Wallet, AlertTriangle, Activity, CircleDashed, Wrench, ChevronRight,
  FileText, ShieldAlert, Zap, GitBranch, ArrowRight, Flame, ChevronDown, BarChart2, History, Calendar,
  ListTree, Send, MessageSquare, XCircle, Lock, Search, SlidersHorizontal
} from 'lucide-react';
import api from '@/lib/api';
import { usersApi } from '@/lib/users-api';
import { ticketsApi, Ticket } from '@/lib/tickets-api';
import { changeRequestsApi, ChangeRequest } from '@/lib/change-requests-api';
import { workflowApi } from '@/lib/workflow-api';
import { risksApi, Risk } from '@/lib/risks-api';
import { issuesApi, ProjectIssue } from '@/lib/issues-api';
import { dependenciesApi, ProjectDependency } from '@/lib/dependencies-api';
import { baselinesApi, Baseline, BaselineDiffEntry } from '@/lib/baselines-api';
import { Task as WbsTask, tasksApi, AuditLogEntry } from '@/lib/tasks-api';
import { taskTypeMasterApi } from '@/lib/task-type-master-api';
import TaskHistoryPanel from '@/components/tasks/TaskHistoryPanel';
import SubtaskPanel from '@/components/tasks/SubtaskPanel';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Upload } from 'lucide-react';
import DocumentPanel from '@/components/documents/DocumentPanel';
import WbsUploadDialog from '@/components/projects/WbsUploadDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string; name: string; description?: string;
  type: string; status: string; startDate: string; endDate?: string;
  allocations?: Allocation[];
  client?: { clientCode: string; name: string } | null;
  pm?: { firstName?: string; lastName?: string } | null;
  methodology?: string | null;
  isInternal?: boolean;
  budgetCost?: number | null;
  revenue?: number | null;
}
interface Task {
  id: string; title: string; status: string; priority: string;
  description?: string | null;
  estimatedEffort?: number; assigneeId?: string | null; assignee?: { id: string; firstName?: string; lastName?: string } | null;
  assigneeIds?: string[];
  taskAssignees?: { user: { id: string; firstName?: string; lastName?: string } }[];
  milestoneId?: string;
  taskType?: string | null; taskTypeMasterId?: string | null; crId?: string | null; phase?: string | null;
  changeRequest?: { id: string; crCode: string; status: string } | null;
  startDate?: string | null; endDate?: string | null;
  dailyEffort?: number | null; dailyEffortOverride?: boolean; workingDays?: number | null;
  parentId?: string | null;
  subTasks?: { id: string; title: string; status: string; assigneeId?: string | null }[];
  parent?: { id: string; title: string } | null;
}
interface TicketItem {
  id: string; title: string; status: string; priority: string;
  type: string; isSlaBreached: boolean; assignee?: { firstName?: string; lastName?: string } | null;
}
interface MilestoneItem {
  id: string; name: string; amount: number; completion: number;
  status: string; dueDate?: string;
}
interface Allocation {
  id: string; startDate: string; endDate: string;
  projectRole?: string;
  user: { id: string; firstName?: string; lastName?: string; email: string };
}

import { useAuthStore } from '@/lib/store/auth';

type Tab = 'dashboard' | 'tasks' | 'planning' | 'tickets' | 'milestones' | 'allocations' | 'changeRequests' | 'documents' | 'risks' | 'issues' | 'dependencies' | 'finance';



// ─── Priority / Status colour helpers ────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH:     'bg-orange-100 text-orange-700',
  MEDIUM:   'bg-yellow-100 text-yellow-700',
  LOW:      'bg-muted text-muted-foreground',
};
const TASK_STATUS_STYLES: Record<string, string> = {
  BACKLOG:   'bg-muted text-muted-foreground',
  TODO:      'bg-blue-100 text-blue-700',
  WIP:       'bg-amber-100 text-amber-700',
  QA:        'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

function Pill({ label, style }: { label: string; style?: string }) {
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', style)}>{label}</span>;
}

import ProjectInsightsDashboard from '@/components/projects/ProjectInsightsDashboard';
import ProjectFinanceTab from '@/components/finance/ProjectFinanceTab';
import {
  DescriptionTextarea, StatusSelect, TaskTypeSelect, AssigneeMultiSelect,
  EstimatedEffortInput, CRLinkSection, AssigneeOption, DailyEffortField,
} from '@/components/tasks/fields';
import { useHolidayDates } from '@/lib/daily-effort';
import MultiSelector from '@/components/ui/multi-selector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronFirst, ChevronLast, ChevronLeft } from 'lucide-react';
import {
  type ColumnDef, type ExpandedState, type PaginationState,
  flexRender, getCoreRowModel, getExpandedRowModel, getPaginationRowModel, useReactTable,
} from '@tanstack/react-table';

// ─── Burn-rate & Margin widgets ───────────────────────────────────────────────

function BurnRateWidget({ projectId }: { projectId: string }) {
  const [data, setData] = useState<{ budgetCost: number; actualCost: number; burnRatePct: number } | null>(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/burn-rate`).then(({ data: d }) => setData(d)).catch(() => {});
  }, [projectId]);

  if (!data || data.budgetCost === 0) return null;

  const pct = Math.min(data.burnRatePct, 100);
  const overBudget = data.burnRatePct > 100;

  return (
    <div className="flex-1 min-w-[200px] bg-card border rounded-xl p-4">
      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Burn Rate</p>
      <div className="flex items-end justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">₹{data.actualCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        <span className={cn('text-xs font-black', overBudget ? 'text-destructive' : 'text-foreground')}>
          {data.burnRatePct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', overBudget ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        of ₹{data.budgetCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })} budget
      </p>
    </div>
  );
}

function MarginWidget({ projectId }: { projectId: string }) {
  const [data, setData] = useState<{ revenue: number; actualCost: number; margin: number } | null>(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/margin`).then(({ data: d }) => setData(d)).catch(() => {});
  }, [projectId]);

  if (!data || data.revenue === 0) return null;

  const isNegative = data.margin < 0;

  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Margin</p>
      <p className={cn('text-2xl font-black', isNegative ? 'text-destructive' : 'text-emerald-600')}>
        {data.margin.toFixed(1)}%
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Rev ₹{data.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

const TASK_PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW:      'bg-muted text-muted-foreground',
};

const TASK_COLUMNS = [
  { id: 'BACKLOG',    title: 'Backlog',     icon: <CircleDashed size={14} className="text-muted-foreground" /> },
  { id: 'WIP',        title: 'In Progress', icon: <Clock size={14} className="text-blue-500" /> },
  { id: 'QA',         title: 'In Review',   icon: <AlertCircle size={14} className="text-purple-500" /> },
  { id: 'COMPLETED',  title: 'Done',        icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
];

function TasksTab({ projectId }: { projectId: string }) {
  const { user: authUser } = useAuthStore();
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [crs, setCrs]       = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState<{ open: boolean; item?: Task }>({ open: false });
  const [form, setForm]     = useState({ title: '', description: '', priority: 'MEDIUM', status: 'BACKLOG', estimatedEffort: '', dailyEffort: '', assigneeIds: [] as string[], taskTypeMasterId: '', crId: '', phase: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'subtasks' | 'history'>('details');
  const [taskHistory, setTaskHistory] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [taskTypes, setTaskTypes]           = useState<{ id: string; name: string }[]>([]);
  const [taskTypesLoading, setTaskTypesLoading] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; firstName?: string | null; lastName?: string | null }[]>([]);
  const [assigneesTouched, setAssigneesTouched] = useState(false);

  // Editable Daily Effort: auto-derived until the user types over it.
  const [dailyEffortManual, setDailyEffortManual] = useState(false);

  // Live auto value for the Daily Effort field — mirrors the server derivation.
  const holidayDates = useHolidayDates(form.startDate, form.endDate);

  // Cap how many cards render per column to keep the DOM small on large boards.
  const COLUMN_PAGE_SIZE = 50;
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  // ── Board filters ────────────────────────────────────────────────────────
  // Applied client-side: the board already holds every task for the project, so
  // filtering needs no refetch and stays instant.
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filtersActive =
    search.trim() !== '' ||
    priorityFilter !== 'ALL' ||
    assigneeFilter !== 'ALL' ||
    typeFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setPriorityFilter('ALL');
    setAssigneeFilter('ALL');
    setTypeFilter('ALL');
  };

  /** Every user id a task is assigned to, across both the legacy single
   *  assigneeId and the multi-assignee join rows. */
  const taskAssigneeIds = (t: Task) => {
    const ids = new Set<string>();
    if (t.assigneeId) ids.add(t.assigneeId);
    if (t.assignee?.id) ids.add(t.assignee.id);
    t.taskAssignees?.forEach(ta => ids.add(ta.user.id));
    return ids;
  };

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter(t => {
      if (query) {
        const haystack = `${t.title} ${t.description ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

      if (assigneeFilter !== 'ALL') {
        const ids = taskAssigneeIds(t);
        if (assigneeFilter === 'UNASSIGNED') {
          if (ids.size > 0) return false;
        } else if (!ids.has(assigneeFilter)) {
          return false;
        }
      }

      if (typeFilter !== 'ALL' && t.taskTypeMasterId !== typeFilter) return false;

      return true;
    });
  }, [tasks, search, priorityFilter, assigneeFilter, typeFilter]);

  // Total shown across the board — column headers show their own counts.
  const matchingTopLevel = filteredTasks.filter(t => !t.parentId).length;

  const toDateInput = (d: string | null | undefined) => (d ? d.substring(0, 10) : '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, crsData] = await Promise.all([
        api.get<Task[]>(`/tasks?projectId=${projectId}`),
        changeRequestsApi.getAll(projectId),
      ]);
      setTasks(data);
      // Filter for linkable CRs (Approved or In Progress)
      const linkableCrs = crsData.filter((cr: ChangeRequest) => 
        !['CLOSED', 'DEFERRED', 'ON-HOLD', 'ON_HOLD'].includes(cr.status)
      );
      setCrs(linkableCrs);
    } catch (error) {
      console.error('Failed to load tasks/crs', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setTaskTypesLoading(true);
    taskTypeMasterApi.getTree()
      .then(types => setTaskTypes(types.filter(t => t.isActive).map(t => ({ id: t.id, name: t.name }))))
      .catch(() => {})
      .finally(() => setTaskTypesLoading(false));
  }, []);

  useEffect(() => {
    usersApi.getTaskAssignees(projectId)
      .then(setAssignableUsers)
      .catch(() => setAssignableUsers([]));
  }, [projectId]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { ...form, projectId };
      if (form.estimatedEffort) payload.estimatedEffort = Number(form.estimatedEffort);
      else delete payload.estimatedEffort;
      // Daily Effort: a hand-typed value wins; empty → let the server derive.
      if (dailyEffortManual && form.dailyEffort.trim() !== '') {
        payload.dailyEffort = Number(form.dailyEffort);
        payload.dailyEffortOverride = true;
      } else {
        delete payload.dailyEffort;
        payload.dailyEffortOverride = false;
      }
      // Backend derives the primary assigneeId from assigneeIds; send the array only.
      if (!modal.item || assigneesTouched) {
        payload.assigneeIds = form.assigneeIds;
      } else {
        delete payload.assigneeIds;
      }
      delete payload.assigneeId;
      if (!form.taskTypeMasterId) delete payload.taskTypeMasterId;
      delete payload.taskType;
      if (!form.crId) { delete payload.crId; delete payload.phase; }
      else if (!form.phase) delete payload.phase;
      if (!form.startDate) delete payload.startDate;
      if (!form.endDate) delete payload.endDate;
      if (modal.item) {
        await api.patch(`/tasks/${modal.item.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      setModal({ open: false });
      await load();
    } catch (error: any) {
      const msg = error.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(', ') : msg || 'Error saving task');
    } finally {
      setSaving(false);
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
    } catch {
      load();
    }
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) handleStatusChange(taskId, newStatus);
  };

  function openEdit(t: Task) {
    setForm({ title: t.title, description: t.description || '', priority: t.priority, status: t.status, estimatedEffort: String(t.estimatedEffort ?? ''), dailyEffort: t.dailyEffortOverride === true && t.dailyEffort != null ? String(t.dailyEffort) : '', assigneeIds: t.taskAssignees?.length ? t.taskAssignees.map(ta => ta.user.id) : ((t.assigneeId || t.assignee?.id) ? [t.assigneeId || t.assignee!.id] : []), taskTypeMasterId: t.taskTypeMasterId || '', crId: t.crId || '', phase: t.phase || '', startDate: toDateInput(t.startDate), endDate: toDateInput(t.endDate) });
    setAssigneesTouched(false);
    setDailyEffortManual(t.dailyEffortOverride === true && t.dailyEffort != null);
    const hasAssignedSubtask = t.assigneeId !== authUser?.id && t.subTasks?.some(st => st.assigneeId === authUser?.id);
    setModalTab(hasAssignedSubtask ? 'subtasks' : 'details');
    setTaskHistory([]);
    setHistoryLoading(true);
    tasksApi.getTaskHistory(t.id)
      .then((res) => setTaskHistory(res.data))
      .catch(() => setTaskHistory([]))
      .finally(() => setHistoryLoading(false));
    setModal({ open: true, item: t });
  }

  return (
    <div className="space-y-4">
      {['ADMIN', 'PM', 'TL'].includes(authUser?.role || '') && (
        <div className="flex justify-end">
          <button
            onClick={() => { setForm({ title: '', description: '', priority: 'MEDIUM', status: 'BACKLOG', estimatedEffort: '', dailyEffort: '', assigneeIds: [], taskTypeMasterId: '', crId: '', phase: '', startDate: '', endDate: '' }); setAssigneesTouched(false); setDailyEffortManual(false); setModalTab('details'); setTaskHistory([]); setModal({ open: true }); }}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:opacity-90 transition-all hover:scale-105"
          >
            <Plus size={14} /> New Task
          </button>
        </div>
      )}
      {/* ── Filter bar ── */}
      <div className="rounded-xl border bg-muted/10 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5 lg:max-w-xs">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title or description..."
                className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5 lg:w-40">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs"
            >
              <option value="ALL">All priorities</option>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 lg:w-52">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Assignee
            </label>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs"
            >
              <option value="ALL">All assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {assignableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 lg:w-48">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Task Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs"
            >
              <option value="ALL">All types</option>
              {taskTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold hover:bg-muted transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>

        {filtersActive && (
          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <SlidersHorizontal size={11} />
            {matchingTopLevel} task{matchingTopLevel === 1 ? '' : 's'} match — column counts below reflect the filter
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_COLUMNS.map(col => {
            const colTasks = filteredTasks.filter(t => {
              const statusMatches = t.status === col.id || (col.id === 'BACKLOG' && t.status === 'TODO');
              return statusMatches && !t.parentId;
            });
            const visible = visibleCounts[col.id] ?? COLUMN_PAGE_SIZE;
            const shownTasks = colTasks.slice(0, visible);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex flex-col min-w-0 bg-muted/5 rounded-xl border border-border/50"
              >
                <div className="p-3 border-b flex justify-between items-center bg-muted/10">
                  <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    {col.icon}
                    {col.title}
                  </h2>
                  <span className="text-xs font-black bg-muted px-2 py-0.5 rounded-full opacity-60">{colTasks.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-3 scroll-smooth">
                  {shownTasks.map(t => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('taskId', t.id)}
                      onClick={() => openEdit(t)}
                      className="bg-card border border-border/60 p-3 rounded-lg shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing group"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className={cn('px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-widest', TASK_PRIORITY_STYLES[t.priority] || TASK_PRIORITY_STYLES.MEDIUM)}>
                          {t.priority}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); openEdit(t); }} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Pencil size={11} /></button>
                          <button onClick={async (e) => { e.stopPropagation(); if (!confirm('Delete this task?')) return; await api.delete(`/tasks/${t.id}`); await load(); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <h3 className="text-xs font-bold text-foreground leading-tight">{t.title}</h3>
                      {t.subTasks && t.subTasks.length > 0 && (() => {
                        const mySubtasks = t.subTasks!.filter(s => s.assigneeId === authUser?.id);
                        return (
                          <div className="flex flex-col gap-1 mt-1.5">
                            <div className="flex items-center gap-1">
                              <ListTree size={10} className="text-muted-foreground/60" />
                              <span className="text-xs font-black text-muted-foreground/60">
                                {t.subTasks!.filter(s => s.status === 'COMPLETED').length}/{t.subTasks!.length} subtasks
                              </span>
                            </div>
                            {t.assigneeId !== authUser?.id && mySubtasks.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-black uppercase tracking-tight">
                                <ListTree size={9} />
                                {mySubtasks.length} assigned to you — open Subtasks tab
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {(t.startDate || t.endDate || t.changeRequest) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-muted-foreground font-medium">
                          {(t.startDate || t.endDate) && (
                            <div className="flex items-center gap-1">
                              <Calendar size={10} />
                              <span>{toDateInput(t.startDate) || '?'} → {toDateInput(t.endDate) || '?'}</span>
                            </div>
                          )}
                          {t.changeRequest && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/5 text-primary border border-primary/10">
                              <Activity size={9} />
                              <span>{t.changeRequest.crCode} ({t.changeRequest.status})</span>
                            </div>
                          )}
                        </div>
                      )}
                      {typeof t.dailyEffort === 'number' && (
                        <span
                          className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded bg-primary/5 text-primary border border-primary/10 text-[10px] font-bold"
                          title={t.workingDays ? `Across ${t.workingDays} working days` : undefined}
                        >
                          {t.dailyEffort} h/day
                        </span>
                      )}
                      {(() => {
                        const people = t.taskAssignees?.length
                          ? t.taskAssignees.map(ta => ta.user)
                          : (t.assignee ? [t.assignee] : []);
                        if (people.length === 0) return null;
                        return (
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t text-xs text-muted-foreground">
                            <div className="flex -space-x-1.5">
                              {people.slice(0, 3).map(p => (
                                <div key={p.id} title={`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()}
                                  className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-card">
                                  {p.firstName?.charAt(0)}{p.lastName?.charAt(0)}
                                </div>
                              ))}
                            </div>
                            {people.length === 1
                              ? `${people[0].firstName ?? ''} ${people[0].lastName ?? ''}`.trim()
                              : `${people.length} assignees`}
                          </div>
                        );
                      })()}
                      <div className="mt-2 flex justify-end gap-1">
                        {TASK_COLUMNS.filter(c => c.id !== t.status).map(c => (
                          <button
                            key={c.id}
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(t.id, c.id); }}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors"
                            title={`Move to ${c.title}`}
                          >
                            <ChevronRight size={10} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {colTasks.length > shownTasks.length && (
                    <button
                      onClick={() => setVisibleCounts(prev => ({ ...prev, [col.id]: visible + COLUMN_PAGE_SIZE }))}
                      className="w-full py-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary rounded-lg border border-dashed transition-colors"
                    >
                      Load more ({colTasks.length - shownTasks.length})
                    </button>
                  )}
                  {colTasks.length === 0 && (
                    <div className="py-8 flex flex-col items-center justify-center text-muted-foreground/30">
                      <p className="text-xs font-black uppercase mt-2">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className={cn('bg-background border rounded-xl w-full shadow-2xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 transition-all', modalTab === 'history' ? 'max-w-5xl' : modalTab === 'subtasks' ? 'max-w-3xl' : 'max-w-2xl')}>

            {/* Header */}
            <div className="flex justify-between items-center px-6 pt-6 pb-4 shrink-0">
              <h2 className="font-black text-sm uppercase tracking-tight">{modal.item ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setModal({ open: false })} className="p-1 rounded-full hover:bg-muted transition-colors"><X size={16} /></button>
            </div>

            {/* Tabs (only when editing) */}
            {modal.item && (
              <div className="flex border-b px-6 shrink-0">
                {(['details', 'subtasks', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setModalTab(tab)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 -mb-px transition-colors',
                      modalTab === tab
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab === 'history' && <History size={12} />}
                    {tab === 'subtasks' && <ListTree size={12} />}
                    {tab}
                    {tab === 'subtasks' && modal.item?.subTasks && modal.item.subTasks.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-black">
                        {modal.item.subTasks.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Details Tab */}
            {modalTab === 'details' && (
              <div className="overflow-y-auto flex-1 px-6 pb-6">
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Title *</label>
                    <input required className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Task title..." />
                  </div>
                  <DescriptionTextarea value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />

                  {/* Start / End Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Calendar size={11} /> Start Date *
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={form.startDate}
                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Calendar size={11} /> End Date *
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={form.endDate}
                        min={form.startDate || undefined}
                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <StatusSelect value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} />
                    <div>
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                      <select className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                        {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <TaskTypeSelect value={form.taskTypeMasterId} onChange={v => setForm(f => ({ ...f, taskTypeMasterId: v }))} options={taskTypes} loading={taskTypesLoading} />
                  <AssigneeMultiSelect
                    value={form.assigneeIds}
                    onChange={ids => {
                      setAssigneesTouched(true);
                      setForm(f => ({ ...f, assigneeIds: ids }));
                    }}
                    options={assignableUsers.map((u): AssigneeOption => ({
                      id: u.id,
                      label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
                    }))}
                    emptyHint="No allocated resources on this project. Allocate users first."
                  />
                  <EstimatedEffortInput value={form.estimatedEffort} onChange={v => setForm(f => ({ ...f, estimatedEffort: v }))} />
                  <DailyEffortField
                    effort={form.estimatedEffort}
                    startDate={form.startDate}
                    endDate={form.endDate}
                    holidayDates={holidayDates}
                    value={form.dailyEffort}
                    touched={dailyEffortManual}
                    onChange={(v, t) => { setForm(f => ({ ...f, dailyEffort: v })); setDailyEffortManual(t); }}
                    onReset={() => { setForm(f => ({ ...f, dailyEffort: '' })); setDailyEffortManual(false); }}
                  />
                  <CRLinkSection
                    crId={form.crId}
                    phase={form.phase}
                    crs={crs}
                    onCrChange={v => setForm(f => ({ ...f, crId: v, phase: v ? f.phase : '' }))}
                    onPhaseChange={v => setForm(f => ({ ...f, phase: v }))}
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setModal({ open: false })} className="px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg border hover:bg-secondary transition-colors">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="px-5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                  </button>
                </div>
              </div>
            )}

            {/* Subtasks Tab */}
            {modalTab === 'subtasks' && modal.item && (
              <div className="overflow-y-auto flex-1 px-6 pb-6 pt-4">
                <SubtaskPanel parentTask={{ ...modal.item, projectId } as WbsTask} />
              </div>
            )}

            {/* History Tab */}
            {modalTab === 'history' && (
              <div className="flex flex-col flex-1 px-6 pb-6 pt-4 gap-4" style={{ minHeight: '480px' }}>
                <div className="flex-1 overflow-auto" style={{ maxHeight: '65vh' }}>
                  <TaskHistoryPanel entries={taskHistory} loading={historyLoading} />
                </div>
                <div className="flex justify-end shrink-0">
                  <button type="button" onClick={() => setModal({ open: false })} className="px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg border hover:bg-secondary transition-colors">Close</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tickets Tab ──────────────────────────────────────────────────────────────

function TicketsTab({ projectId }: { projectId: string }) {
  const { user: authUser } = useAuthStore();
  
  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<{ open: boolean; item?: Ticket }>({ open: false });
  const [form, setForm]             = useState<Partial<Ticket>>({ title: '', type: 'L1', priority: 'MEDIUM', status: 'OPEN', description: '' });
  const [saving, setSaving]         = useState(false);
  const [creationNotice, setCreationNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ticketsApi.getTickets(projectId);
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const safePayload = {
        title:        form.title,
        description:  form.description,
        type:         form.type,
        priority:     form.priority,
        status:       form.status,
        assigneeId:   form.assigneeId,
        targetDate:   form.targetDate,
        complexity:   form.complexity,
        techStack:    form.techStack,
        isSlaBreached: form.isSlaBreached,
      };
      if (modal.item) {
        await ticketsApi.updateTicket(modal.item.id, safePayload);
        setModal({ open: false });
      } else {
        await ticketsApi.createTicket({ ...safePayload, projectId });
        setModal({ open: false });
        // Show auto-task creation notice
        setCreationNotice(`Ticket created — a linked fix task has been auto-assigned to the project TL.`);
        setTimeout(() => setCreationNotice(null), 6000);
      }
      await load();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to save ticket');
    } finally { setSaving(false); }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    try {
      await ticketsApi.updateTicket(ticketId, { status: newStatus });
    } catch (err) {
      console.error(err);
      load();
    }
  };

  const columns = [
    { id: 'OPEN',        title: 'Open',         icon: <CircleDashed size={14} className="text-muted-foreground" /> },
    { id: 'IN_PROGRESS', title: 'In Progress',  icon: <Clock size={14} className="text-blue-500" /> },
    { id: 'RESOLVED',    title: 'Resolved',     icon: <AlertCircle size={14} className="text-purple-500" /> },
    { id: 'CLOSED',      title: 'Closed',       icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
  ];

  const priorityStyle: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    HIGH:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    MEDIUM:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    LOW:      'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-4 h-[600px] flex flex-col">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Manage project support tickets</h2>
        {['ADMIN', 'PM', 'TL'].includes(authUser?.role || '') && (
          <button 
            onClick={() => { setForm({ title: '', type: 'L1', priority: 'MEDIUM', status: 'OPEN', description: '' }); setModal({ open: true }); }}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:opacity-90"
          >
            <Plus size={14} /> New Ticket
          </button>
        )}
      </div>

      {/* Auto-task creation notice */}
      {creationNotice && (
        <div className="mx-2 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700">
          <Wrench size={13} className="shrink-0" />
          {creationNotice}
          <button onClick={() => setCreationNotice(null)} className="ml-auto text-emerald-500 hover:text-emerald-700"><X size={12} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" /></div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden p-2">
          {columns.map(col => {
            const colTickets = tickets.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="flex flex-col min-w-0 bg-muted/5 rounded-xl border border-border/50">
                <div className="p-3 border-b flex justify-between items-center bg-muted/10">
                  <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    {col.icon} {col.title}
                  </h2>
                  <span className="text-xs font-black bg-muted px-2 py-0.5 rounded-full opacity-60">{colTickets.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                  {colTickets.map(ticket => (
                    <div 
                      key={ticket.id} 
                      onClick={() => {
                        setForm({
                          title:        ticket.title,
                          description:  ticket.description ?? '',
                          type:         ticket.type,
                          priority:     ticket.priority,
                          status:       ticket.status,
                          assigneeId:   ticket.assigneeId ?? undefined,
                          targetDate:   ticket.targetDate ?? undefined,
                          complexity:   ticket.complexity,
                          techStack:    ticket.techStack ?? undefined,
                          isSlaBreached: ticket.isSlaBreached,
                        });
                        setModal({ open: true, item: ticket });
                      }}
                      className="bg-card border border-border/60 p-3 rounded-lg shadow-sm hover:border-primary/30 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-widest',
                          ticket.type === 'L1' ? 'bg-blue-100 text-blue-700' : ticket.type === 'L2' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {ticket.type}
                        </span>
                        <span className={cn('px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-widest', priorityStyle[ticket.priority] || priorityStyle.MEDIUM)}>
                          {ticket.priority}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-foreground leading-tight">{ticket.title}</h3>

                      {/* Linked tasks — rich rows */}
                      {(ticket.tasks ?? []).length > 0 && (() => {
                        const taskStatusColor: Record<string, string> = {
                          TODO: 'bg-muted text-muted-foreground',
                          BACKLOG: 'bg-muted text-muted-foreground',
                          WIP: 'bg-blue-100 text-blue-700',
                          QA: 'bg-purple-100 text-purple-700',
                          COMPLETED: 'bg-emerald-100 text-emerald-700',
                        };
                        return (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                              <Wrench size={9} /> Linked Task{ticket.tasks!.length > 1 ? 's' : ''}
                            </p>
                            {ticket.tasks!.map((t) => (
                              <div key={t.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/40">
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${taskStatusColor[t.status] ?? taskStatusColor.BACKLOG}`}>
                                  {t.status === 'WIP' ? 'WIP' : t.status}
                                </span>
                                <span className="flex-1 text-[10px] font-bold text-foreground truncate">{t.title}</span>
                                {t.assignee && (
                                  <span className="shrink-0 text-[10px] font-bold text-muted-foreground truncate max-w-[60px]">
                                    {[t.assignee.firstName, t.assignee.lastName].filter(Boolean).join(' ')}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <div className="mt-3 pt-3 border-t flex justify-end gap-1">
                        {columns.filter(c => c.id !== ticket.status).map(c => (
                          <button 
                            key={c.id} 
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(ticket.id, c.id); }}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors"
                            title={`Move to ${c.title}`}
                          >
                            <ChevronRight size={10} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-xl p-5 w-full max-w-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-black text-sm uppercase tracking-tight">{modal.item ? 'Edit Ticket' : 'New Ticket'}</h2>
              <button onClick={() => setModal({ open: false })}><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Title *</label>
                <input required className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none min-h-[60px]" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-sm font-medium mb-1 block text-xs uppercase font-black">Type</label><select className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{['L1', 'L2', 'L3'].map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label className="text-sm font-medium mb-1 block text-xs uppercase font-black">Priority</label><select className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p}>{p}</option>)}</select></div>
                <div><label className="text-sm font-medium mb-1 block text-xs uppercase font-black">Status</label><select className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => <option key={s}>{s}</option>)}</select></div>
              </div>

              {/* Linked tasks — visible when editing */}
              {modal.item && (modal.item.tasks ?? []).length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center gap-2">
                    <Wrench size={11} className="text-muted-foreground" />
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                      Linked Tasks ({modal.item.tasks!.length})
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {modal.item.tasks!.map((t) => {
                      const statusStyle: Record<string, string> = {
                        TODO: 'bg-muted text-muted-foreground',
                        BACKLOG: 'bg-muted text-muted-foreground',
                        WIP: 'bg-blue-100 text-blue-700',
                        QA: 'bg-purple-100 text-purple-700',
                        COMPLETED: 'bg-emerald-100 text-emerald-700',
                      };
                      const priorityStyle2: Record<string, string> = {
                        CRITICAL: 'text-red-600', HIGH: 'text-orange-500', MEDIUM: 'text-yellow-600', LOW: 'text-muted-foreground',
                      };
                      return (
                        <div key={t.id} className="px-3 py-2.5 flex items-center gap-3">
                          <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-black uppercase ${statusStyle[t.status] ?? statusStyle.BACKLOG}`}>
                            {t.status === 'WIP' ? 'In Progress' : t.status}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{t.title}</p>
                            {t.assignee && (
                              <p className="text-[10px] text-muted-foreground">
                                Assigned to {[t.assignee.firstName, t.assignee.lastName].filter(Boolean).join(' ')}
                              </p>
                            )}
                          </div>
                          <span className={`shrink-0 text-[10px] font-black uppercase ${priorityStyle2[t.priority] ?? 'text-muted-foreground'}`}>
                            {t.priority}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Info banner on new ticket */}
              {!modal.item && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <Wrench size={12} className="shrink-0 mt-0.5" />
                  <p>A linked fix task will be <strong>auto-created</strong> and assigned to the project TL when you save.</p>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setModal({ open: false })} className="px-4 py-1.5 text-xs font-black uppercase border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase shadow-sm">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Milestones Tab ───────────────────────────────────────────────────────────

function MilestonesTab({ projectId }: { projectId: string }) {
  const [items, setItems]     = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<{ open: boolean; item?: MilestoneItem }>({ open: false });
  const [form, setForm]       = useState({ name: '', amount: '', completion: '0', dueDate: '' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<MilestoneItem[]>(`/milestones?projectId=${projectId}`);
    setItems(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { name: form.name, amount: Number(form.amount), completion: Number(form.completion), projectId, dueDate: form.dueDate || undefined };
      if (modal.item) {
        await api.patch(`/milestones/${modal.item.id}`, payload);
      } else {
        await api.post('/milestones', payload);
      }
      setModal({ open: false });
      await load();
    } finally { setSaving(false); }
  }

  const STATUS_STYLE: Record<string, string> = {
    PENDING: 'bg-muted text-muted-foreground', PARTIAL: 'bg-amber-100 text-amber-700', ACHIEVED: 'bg-emerald-100 text-emerald-700', FULLY_INVOICED: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setForm({ name: '', amount: '', completion: '0', dueDate: '' }); setModal({ open: true }); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={14} /> New Milestone
        </button>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div> : (
        <div className="space-y-3">
          {items.map((m) => (
            <div key={m.id} className="bg-card border rounded-xl p-4 hover:border-primary/40 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm">{m.name}</p>
                  {m.dueDate && <p className="text-xs text-muted-foreground">Due {new Date(m.dueDate).toLocaleDateString('en-IN')}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Pill label={m.status} style={STATUS_STYLE[m.status]} />
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setForm({ name: m.name, amount: String(m.amount), completion: String(m.completion), dueDate: m.dueDate?.split('T')[0] ?? '' }); setModal({ open: true, item: m }); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Pencil size={13} /></button>
                    <button onClick={async () => { if (!confirm('Delete?')) return; await api.delete(`/milestones/${m.id}`); await load(); }} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">₹{m.amount.toLocaleString('en-IN')}</span>
                <span className="text-xs font-medium">{m.completion}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${m.completion}%` }} />
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">No milestones yet.</p>}
        </div>
      )}
      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-xl p-6 w-full max-w-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h2 className="font-semibold text-lg">{modal.item ? 'Edit Milestone' : 'New Milestone'}</h2><button onClick={() => setModal({ open: false })}><X size={18} /></button></div>
            <div className="space-y-4">
              <div><label className="text-sm font-medium mb-1 block">Name *</label><input className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium mb-1 block">Amount (₹)</label><input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                <div><label className="text-sm font-medium mb-1 block">Completion %</label><input type="number" min={0} max={100} className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none" value={form.completion} onChange={(e) => setForm((f) => ({ ...f, completion: e.target.value }))} /></div>
              </div>
              <div><label className="text-sm font-medium mb-1 block">Due Date</label><input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal({ open: false })} className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Allocations Tab ──────────────────────────────────────────────────────────

const PROJECT_ROLES = [
  'Developer',
  'Senior Developer',
  'Lead Developer',
  'QA Engineer',
  'QA Lead',
  'UI/UX Designer',
  'Project Manager',
  'Team Lead',
  'Architect',
  'DevOps Engineer',
  'Business Analyst'
];

function AllocationsTab({ projectId }: { projectId: string }) {
  const [items, setItems]     = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers]     = useState<any[]>([]);
  const [modal, setModal]     = useState<{ open: boolean; item?: Allocation }>({ open: false });
  const [form, setForm]       = useState({ userId: '', startDate: '', endDate: '', projectRole: '' });
  const [allocationRows, setAllocationRows] = useState<Array<{ userId: string; startDate: string; endDate: string; projectRole: string }>>([]);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  // Empty = show every allocation ever made to this project, past and future.
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo]     = useState('');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId });
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      const { data } = await api.get<Allocation[]>(`/allocations?${params.toString()}`);
      setItems(data);
    } catch (err) {
      console.error('Error loading allocations:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, filterFrom, filterTo]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users/allocatable');
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }, []);

  useEffect(() => { 
    load();
    loadUsers();
  }, [load, loadUsers]);

  async function handleSave() {
    if (!form.userId || !form.startDate || !form.endDate) {
      alert('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      if (modal.item) {
        const payload = {
          projectId,
          userId: form.userId,
          projectRole: form.projectRole || undefined,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
        };
        await api.patch(`/allocations/${modal.item.id}`, payload);
      } else {
        await api.post('/allocations/bulk', {
          allocations: allocationRows.map(row => ({
            projectId,
            userId: row.userId,
            resourceType: 'EMPLOYEE',
            projectRole: row.projectRole || undefined,
            startDate: new Date(row.startDate).toISOString(),
            endDate: new Date(row.endDate).toISOString(),
          })),
        });
      }
      setModal({ open: false });
      await load();
      setToast({ msg: modal.item ? 'Allocation updated.' : 'Allocation(s) added.', type: 'success' });
    } catch (error: any) {
      const data = error.response?.data;
      const rowErrors = Array.isArray(data?.errors)
        ? data.errors.map((e: { row: number; message: string }) => `Row ${e.row}: ${e.message}`).join('\n')
        : '';
      const msg = data?.message;
      setToast({
        msg: rowErrors || (Array.isArray(msg) ? msg.join(', ') : msg) || 'Error saving allocation',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  function openAdd() {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
    setForm({
      userId: '',
      projectRole: '',
      startDate,
      endDate,
    });
    setAllocationRows([]);
    setModal({ open: true });
  }

  function updateSelectedResources(ids: string[]) {
    setAllocationRows(prev => ids.map(id => {
      const existing = prev.find(row => row.userId === id);
      return existing ?? {
        userId: id,
        projectRole: form.projectRole || '',
        startDate: form.startDate,
        endDate: form.endDate,
      };
    }));
    setForm(current => ({ ...current, userId: ids[0] ?? '' }));
  }

  function updateAllocationRow(userId: string, patch: Partial<{ startDate: string; endDate: string; projectRole: string }>) {
    setAllocationRows(prev => prev.map(row => row.userId === userId ? { ...row, ...patch } : row));
  }

  function removeAllocationRow(userId: string) {
    setAllocationRows(prev => {
      const next = prev.filter(row => row.userId !== userId);
      setForm(current => ({ ...current, userId: next[0]?.userId ?? '' }));
      return next;
    });
  }

  const filteredItems = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) => {
      const user = (a as any).user;
      const freelancer = (a as any).freelancer;
      const resourceName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : freelancer?.fullName ?? '';
      const resourceEmail = user?.email ?? freelancer?.email ?? '';
      return resourceName.toLowerCase().includes(q) || resourceEmail.toLowerCase().includes(q);
    });
  }, [items, userSearch]);

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-[10000] max-w-sm animate-in fade-in slide-in-from-top-2">
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg text-xs ${
              toast.type === 'error'
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {toast.type === 'error'
              ? <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
            <p className="whitespace-pre-line flex-1">{toast.msg}</p>
            <button onClick={() => setToast(null)} className="shrink-0 hover:opacity-70"><X size={13} /></button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal size={13} className="text-muted-foreground" />
          <div className="flex items-center gap-1.5 relative">
            <Search size={12} className="absolute left-2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search resource..."
              className="border rounded-lg pl-6 pr-2 py-1 text-xs bg-background focus:outline-none w-40"
              aria-label="Search resource"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-muted-foreground" />
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs bg-background focus:outline-none"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs bg-background focus:outline-none"
              aria-label="To date"
            />
          </div>
          {(filterFrom || filterTo || userSearch) && (
            <button
              onClick={() => { setFilterFrom(''); setFilterTo(''); setUserSearch(''); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={12} /> Clear
            </button>
          )}
          {!filterFrom && !filterTo && !userSearch && (
            <span className="text-xs text-muted-foreground">Showing all allocations (past, current &amp; future)</span>
          )}
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={14} /> Add Allocation
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div> : (
        <div className="space-y-3">
          {filteredItems.map((a) => {
            const user = (a as any).user;
            const freelancer = (a as any).freelancer;
            const resourceName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : freelancer?.fullName ?? 'Unknown resource';
            const resourceEmail = user?.email ?? freelancer?.email ?? 'N/A';
            return (
            <div key={a.id} className="flex items-center gap-4 px-3 py-2 bg-card border rounded-lg hover:border-primary/40 transition-colors group">
              <div className="w-52 min-w-0">
                <p className="text-xs font-medium truncate">
                  {resourceName}
                  {a.projectRole && <span className="text-muted-foreground font-normal ml-1.5">({a.projectRole})</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{resourceEmail}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {new Date(a.startDate).toLocaleDateString('en-IN')} → {new Date(a.endDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {user && <button
                  onClick={() => {
                    setForm({
                      userId: user.id,
                      projectRole: a.projectRole || '',
                      startDate: new Date(a.startDate).toISOString().split('T')[0],
                      endDate: new Date(a.endDate).toISOString().split('T')[0],
                    });
                    setModal({ open: true, item: a });
                  }}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
                >
                  <Pencil size={14} />
                </button>}
                <button
                  onClick={async () => { if (!confirm('Remove allocation?')) return; await api.delete(`/allocations/${a.id}`); await load(); }}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            );
          })}
          {filteredItems.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-8">
              {items.length === 0 ? 'No allocations yet. Add one to get started.' : 'No resources match your search.'}
            </p>
          )}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-xl p-6 w-full max-w-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-semibold text-lg">{modal.item ? 'Edit Allocation' : 'Add Allocation'}</h2>
              <button onClick={() => setModal({ open: false })} className="p-1 rounded hover:bg-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Resource *</label>
                {modal.item ? (
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    disabled
                  >
                    <option value="">-- Select Resource --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                    ))}
                  </select>
                ) : (
                  <MultiSelector
                    value={allocationRows.map(row => row.userId)}
                    onValueChange={updateSelectedResources}
                    options={users.map((u) => ({
                      value: u.id,
                      label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
                      subLabel: u.email,
                    }))}
                    placeholder="Select resources..."
                    maxCount={3}
                    popoverClass="z-[10000]"
                  />
                )}
              </div>
              {modal.item ? <div>
                <label className="text-sm font-medium mb-1 block">Project Role</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={form.projectRole}
                  onChange={(e) => setForm({ ...form, projectRole: e.target.value })}
                >
                  <option value="">-- Select Role --</option>
                  {PROJECT_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div> : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resource</TableHead>
                        <TableHead className="w-44 text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</TableHead>
                        <TableHead className="w-36 text-xs font-bold uppercase tracking-wider text-muted-foreground">Start</TableHead>
                        <TableHead className="w-36 text-xs font-bold uppercase tracking-wider text-muted-foreground">End</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {allocationRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                            Select one or more resources to configure allocations.
                          </TableCell>
                        </TableRow>
                      ) : allocationRows.map(row => {
                        const user = users.find(u => u.id === row.userId);
                        return (
                          <TableRow key={row.userId} className="hover:bg-muted/20">
                            <TableCell>
                              <div className="min-w-48">
                                <p className="truncate font-semibold">{user?.firstName} {user?.lastName}</p>
                                <p className="truncate text-muted-foreground">{user?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <select className="w-40 border rounded-md px-2 py-1.5 text-xs bg-background focus:outline-none" value={row.projectRole} onChange={(e) => updateAllocationRow(row.userId, { projectRole: e.target.value })}>
                                <option value="">-- Select Role --</option>
                                {PROJECT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                              </select>
                            </TableCell>
                            <TableCell>
                              <input type="date" className="w-32 border rounded-md px-2 py-1.5 text-xs bg-background focus:outline-none" value={row.startDate} onChange={(e) => updateAllocationRow(row.userId, { startDate: e.target.value })} />
                            </TableCell>
                            <TableCell>
                              <input type="date" className="w-32 border rounded-md px-2 py-1.5 text-xs bg-background focus:outline-none" value={row.endDate} min={row.startDate} onChange={(e) => updateAllocationRow(row.userId, { endDate: e.target.value })} />
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => removeAllocationRow(row.userId)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              >
                                <X size={14} />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {modal.item && <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Start Date *</label>
                  <input 
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End Date *</label>
                  <input 
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal({ open: false })} className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeRequestsTab({ projectId, project }: { projectId: string; project: Project }) {
  const { user } = useAuthStore();
  const [crs, setCrs] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCr, setSelectedCr] = useState<ChangeRequest | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [pendingWorkflows, setPendingWorkflows] = useState<any[]>([]);
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([]);
  const [comment, setComment] = useState('');

  const [newCr, setNewCr] = useState<any>({
    projectId: projectId,
    title: '',
    type: 'SCOPE',
    description: '',
    impactedScope: '',
    budgetDelta: '',
    timelineDeltaDays: '',
  });

  const loadCrs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await changeRequestsApi.getAll(projectId);
      setCrs(data);
    } catch (error) {
      console.error('Failed to load CRs', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadPendingWorkflows = useCallback(async () => {
    try {
      const data = await workflowApi.getPending();
      setPendingWorkflows(data.filter((w: any) => w.entityType === 'CR'));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadCrs();
    loadPendingWorkflows();
  }, [loadCrs, loadPendingWorkflows]);

  const handleCreateCr = async () => {
    try {
      await changeRequestsApi.create({
        ...newCr,
        budgetDelta: newCr.budgetDelta ? Number(newCr.budgetDelta) : undefined,
        timelineDeltaDays: newCr.timelineDeltaDays ? Number(newCr.timelineDeltaDays) : undefined,
      });
      setIsNewModalOpen(false);
      setNewCr({
        projectId: projectId,
        title: '',
        type: 'SCOPE',
        description: '',
        impactedScope: '',
        budgetDelta: '',
        timelineDeltaDays: '',
      });
      loadCrs();
    } catch (error) {
      alert('Failed to create CR');
    }
  };

  const handleSubmitCr = async (id: string) => {
    if (!confirm('Submit this CR for approval?')) return;
    try {
      await changeRequestsApi.submit(id);
      loadCrs();
      loadPendingWorkflows();
      if (selectedCr?.id === id) {
        const updated = await changeRequestsApi.getOne(id);
        setSelectedCr(updated);
        fetchWorkflowHistory(id);
      }
    } catch (error) {
      alert('Failed to submit CR');
    }
  };

  const handleWorkflowAction = async (action: string) => {
    if (!selectedCr) return;
    const pendingInstance = pendingWorkflows.find(w => w.entityId === selectedCr.id);
    if (!pendingInstance) return;

    try {
      await workflowApi.takeAction(pendingInstance.id, action, `User action from Project Tab: ${action}`);
      loadCrs();
      loadPendingWorkflows();
      const updated = await changeRequestsApi.getOne(selectedCr.id);
      setSelectedCr(updated);
      fetchWorkflowHistory(selectedCr.id);
    } catch (error) {
      alert(`Failed to ${action} CR`);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedCr) return;
    try {
      await changeRequestsApi.update(selectedCr.id, { status: newStatus as any });
      await loadCrs();
      const updated = await changeRequestsApi.getOne(selectedCr.id);
      setSelectedCr(updated);
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const fetchWorkflowHistory = async (crId: string) => {
    try {
      const res = await api.get(`/workflow/history/CR/${crId}`);
      setWorkflowHistory(res.data);
    } catch (error) {
      setWorkflowHistory([]);
    }
  };

  const handleSelectCr = async (cr: ChangeRequest) => {
    const fullCr = await changeRequestsApi.getOne(cr.id);
    setSelectedCr(fullCr);
    fetchWorkflowHistory(cr.id);
  };

  const handleAddComment = async () => {
    if (!selectedCr || !comment.trim()) return;
    try {
      const newComment = await changeRequestsApi.addComment(selectedCr.id, comment);
      setSelectedCr({
        ...selectedCr,
        comments: [newComment, ...(selectedCr.comments || [])]
      });
      setComment('');
    } catch (error) {
      alert('Failed to add comment');
    }
  };

  const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
    DRAFT:       { bg: 'bg-muted',        text: 'text-muted-foreground', icon: Pencil },
    SUBMITTED:   { bg: 'bg-blue-50',      text: 'text-blue-600',         icon: Clock },
    APPROVED:    { bg: 'bg-emerald-50',   text: 'text-emerald-600',      icon: CheckCircle2 },
    REJECTED:    { bg: 'bg-red-50',       text: 'text-red-600',          icon: XCircle },
    IN_PROGRESS: { bg: 'bg-violet-50',    text: 'text-violet-600',       icon: Activity },
    CLOSED:      { bg: 'bg-secondary',    text: 'text-muted-foreground', icon: Lock },
    DEFERRED:    { bg: 'bg-amber-50',     text: 'text-amber-600',        icon: Clock },
    ON_HOLD:     { bg: 'bg-orange-50',    text: 'text-orange-600',       icon: Clock },
  };

  const TYPE_STYLES: Record<string, string> = {
    SCOPE: 'bg-purple-100 text-purple-700',
    BUDGET: 'bg-emerald-100 text-emerald-700',
    TIMELINE: 'bg-blue-100 text-blue-700',
    RESOURCE: 'bg-orange-100 text-orange-700',
    COMBINED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Project Change Requests</h2>
          <p className="text-[10px] text-muted-foreground mt-1">Manage scope, budget, and timeline modifications</p>
        </div>
        <button 
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-all active:scale-95 shadow-sm"
        >
          <Plus size={14} /> New CR
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* CR List */}
          <div className={cn(
            "gap-3", 
            selectedCr 
              ? "lg:col-span-4 flex flex-col max-h-[800px] overflow-y-auto pr-1" 
              : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 h-max"
          )}>
            {crs.map((cr) => (
              <div 
                key={cr.id} 
                onClick={() => handleSelectCr(cr)}
                className={cn(
                  "bg-card border rounded-lg p-3 hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden",
                  selectedCr?.id === cr.id ? "ring-2 ring-primary/20 border-primary bg-primary/5" : ""
                )}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10px] text-primary tracking-widest uppercase">{cr.crCode}</span>
                    <div className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-tighter",
                      STATUS_STYLES[cr.status]?.bg,
                      STATUS_STYLES[cr.status]?.text
                    )}>
                      {cr.status}
                    </div>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-bold opacity-40">{new Date(cr.createdAt).toLocaleDateString()}</span>
                </div>
                
                <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1 mb-2">{cr.title}</h3>
                
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold border-t pt-2 mt-auto">
                  <span className="uppercase tracking-tighter opacity-60">{cr.type}</span>
                  <div className="flex gap-2 ml-auto">
                    {cr.budgetDelta != null && cr.budgetDelta !== 0 && (
                      <span className={cn(cr.budgetDelta > 0 ? "text-red-600" : "text-emerald-600")}>
                        {cr.budgetDelta > 0 ? '+' : ''}₹{cr.budgetDelta.toLocaleString()}
                      </span>
                    )}
                    {cr.timelineDeltaDays != null && cr.timelineDeltaDays !== 0 && (
                      <span className={cn(cr.timelineDeltaDays > 0 ? "text-red-600" : "text-emerald-600")}>
                        {cr.timelineDeltaDays > 0 ? '+' : ''}{cr.timelineDeltaDays}d
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {crs.length === 0 && (
              <div className="lg:col-span-12 flex flex-col items-center justify-center py-16 text-muted-foreground bg-secondary/10 rounded-2xl border-2 border-dashed">
                <Activity size={32} className="opacity-20 mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest">No change requests</p>
                <button onClick={() => setIsNewModalOpen(true)} className="mt-4 text-primary text-xs font-bold hover:underline">Create your first CR</button>
              </div>
            )}
          </div>

          {/* CR Details Panel */}
          {selectedCr && (
            <div className="lg:col-span-8 bg-card border rounded-xl shadow-sm flex flex-col h-max max-h-[800px] animate-in slide-in-from-right-4 duration-300 overflow-hidden">
              <div className="p-4 border-b bg-secondary/10 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-black text-primary tracking-widest uppercase">{selectedCr.crCode}</span>
                  <h3 className="font-bold text-sm leading-tight">{selectedCr.title}</h3>
                </div>
                <button onClick={() => setSelectedCr(null)} className="p-1 hover:bg-secondary rounded-lg transition-colors">
                  <XCircle size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-6">
                {/* Actions */}
                <div className="flex gap-2">
                  {selectedCr.status === 'DRAFT' && (
                    <button 
                      onClick={() => handleSubmitCr(selectedCr.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Send size={14} /> Submit for Approval
                    </button>
                  )}
                  {selectedCr.status === 'SUBMITTED' && pendingWorkflows.some(w => w.entityId === selectedCr.id) && (
                    <>
                      <button
                        onClick={() => handleWorkflowAction('APPROVE')}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleWorkflowAction('REJECT')}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-secondary/10 rounded-xl space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Type</p>
                    <p className="text-xs font-bold">{selectedCr.type}</p>
                  </div>
                  <div className="p-3 bg-secondary/10 rounded-xl space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Status</p>
                    {['ADMIN', 'PM', 'TL'].includes(user?.role || '') ? (
                      <select 
                        className={cn("text-xs font-bold bg-transparent border-none p-0 focus:ring-0 cursor-pointer", STATUS_STYLES[selectedCr.status]?.text)}
                        value={selectedCr.status}
                        onChange={(e) => handleStatusUpdate(e.target.value)}
                      >
                        {Object.keys(STATUS_STYLES).map(s => (
                          <option key={s} value={s} className="bg-background text-foreground font-medium">{s}</option>
                        ))}
                      </select>
                    ) : (
                      <p className={cn("text-xs font-bold", STATUS_STYLES[selectedCr.status]?.text)}>{selectedCr.status}</p>
                    )}
                  </div>
                  <div className="p-3 bg-secondary/10 rounded-xl space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Budget Impact</p>
                    <p className={cn("text-xs font-bold", (selectedCr.budgetDelta || 0) > 0 ? "text-red-600" : (selectedCr.budgetDelta || 0) < 0 ? "text-emerald-600" : "")}>
                      {(selectedCr.budgetDelta || 0) > 0 ? '+' : ''}₹{selectedCr.budgetDelta?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-secondary/10 rounded-xl space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Timeline Impact</p>
                    <p className={cn("text-xs font-bold", (selectedCr.timelineDeltaDays || 0) > 0 ? "text-red-600" : "")}>
                      {(selectedCr.timelineDeltaDays || 0) > 0 ? '+' : ''}{selectedCr.timelineDeltaDays || 0} Days
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Description</p>
                  <p className="text-xs text-foreground/80 leading-relaxed bg-secondary/5 p-3 rounded-xl border border-dashed">{selectedCr.description || 'No description provided.'}</p>
                </div>

                {/* Workflow History */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    <History size={10} /> Approval Flow
                  </div>
                  <div className="space-y-2 relative pl-3 border-l-2 border-dashed border-muted">
                    {workflowHistory.length > 0 ? workflowHistory.map((h: any, i: number) => (
                      <div key={i} className="text-[10px]">
                        <span className="font-bold text-foreground">{h.status}</span> by <span className="font-bold text-primary">{h.requester?.firstName}</span>
                        <p className="text-muted-foreground">{new Date(h.updatedAt).toLocaleString()}</p>
                      </div>
                    )) : (
                      <p className="text-[10px] text-muted-foreground italic">No workflow actions yet.</p>
                    )}
                  </div>
                </div>

                {/* Comments */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    <MessageSquare size={10} /> Discussion
                  </div>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-secondary/10 border-none rounded-lg px-3 py-1.5 text-xs focus:ring-1 ring-primary"
                      placeholder="Add insight..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    />
                    <button onClick={handleAddComment} className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
                      <Send size={14} />
                    </button>
                  </div>
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedCr.comments?.map((c) => (
                      <div key={c.id} className="text-[11px] bg-secondary/5 p-2 rounded-lg border border-transparent hover:border-border">
                        <div className="flex justify-between font-bold mb-1">
                          <span>{c.author.firstName}</span>
                          <span className="opacity-40 text-[9px]">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-muted-foreground leading-tight">{c.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New CR Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
              <Plus size={16} className="text-primary" /> Create Change Request
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Title *</label>
                  <input 
                    className="w-full bg-secondary/10 border-none rounded-xl px-4 py-2 text-xs focus:ring-2 ring-primary/20 transition-all"
                    value={newCr.title}
                    onChange={(e) => setNewCr({...newCr, title: e.target.value})}
                    placeholder="Brief objective..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Type</label>
                  <select 
                    className="w-full bg-secondary/10 border-none rounded-xl px-4 py-2 text-xs focus:ring-2 ring-primary/20"
                    value={newCr.type}
                    onChange={(e) => setNewCr({...newCr, type: e.target.value})}
                  >
                    <option value="SCOPE">Scope</option>
                    <option value="BUDGET">Budget</option>
                    <option value="TIMELINE">Timeline</option>
                    <option value="RESOURCE">Resource</option>
                    <option value="COMBINED">Combined</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Impact</label>
                  <div className="flex items-center gap-2 text-xs h-9 px-2 bg-secondary/5 rounded-xl text-muted-foreground italic">
                    Affects {newCr.type.toLowerCase()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Budget Delta (₹)</label>
                  <input 
                    type="number"
                    className="w-full bg-secondary/10 border-none rounded-xl px-4 py-2 text-xs focus:ring-2 ring-primary/20"
                    value={newCr.budgetDelta}
                    onChange={(e) => setNewCr({...newCr, budgetDelta: e.target.value})}
                    placeholder="+/- Amount"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Days Delta</label>
                  <input 
                    type="number"
                    className="w-full bg-secondary/10 border-none rounded-xl px-4 py-2 text-xs focus:ring-2 ring-primary/20"
                    value={newCr.timelineDeltaDays}
                    onChange={(e) => setNewCr({...newCr, timelineDeltaDays: e.target.value})}
                    placeholder="+/- Days"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Detailed Rationale</label>
                <textarea 
                  className="w-full bg-secondary/10 border-none rounded-xl px-4 py-2 text-xs focus:ring-2 ring-primary/20 min-h-[100px]"
                  value={newCr.description}
                  onChange={(e) => setNewCr({...newCr, description: e.target.value})}
                  placeholder="Why is this change necessary?"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-8">
              <button onClick={() => setIsNewModalOpen(false)} className="px-4 py-2 text-xs font-bold hover:bg-secondary rounded-xl transition-colors">Cancel</button>
              <button 
                onClick={handleCreateCr}
                disabled={!newCr.title}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
              >
                Create Change Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Risk Heat Map ────────────────────────────────────────────────────────────

const PROBS = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const;
const IMPACTS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const PW: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4 };
const IW: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const scoreColor = (s: number) => s >= 10 ? 'bg-red-200' : s >= 5 ? 'bg-amber-100' : 'bg-green-100';

function RiskHeatMap({ risks }: { risks: Risk[] }) {
  return (
    <div className="bg-card border rounded-xl p-4 w-fit">
      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Heat Map</p>
      <div className="flex items-center gap-1 mb-1 pl-16">
        {PROBS.map((p) => (
          <div key={p} className="w-10 text-xs text-center font-black text-muted-foreground uppercase">
            {p === 'VERY_HIGH' ? 'VH' : p.slice(0, 3)}
          </div>
        ))}
      </div>
      {IMPACTS.map((imp) => (
        <div key={imp} className="flex items-center gap-1 mb-1">
          <div className="w-16 text-xs font-black text-muted-foreground uppercase text-right pr-2">{imp}</div>
          {PROBS.map((prob) => {
            const cnt = risks.filter((r) => r.probability === prob && r.impact === imp).length;
            const s = (PW[prob] ?? 1) * (IW[imp] ?? 1);
            return (
              <div key={prob} className={cn('w-10 h-10 rounded border flex items-center justify-center', scoreColor(s))}>
                {cnt > 0 && (
                  <span className="w-5 h-5 rounded-full bg-card/80 flex items-center justify-center text-xs font-black">
                    {cnt}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-xs text-center text-muted-foreground font-bold mt-1 pl-16 uppercase tracking-widest">Probability →</p>
    </div>
  );
}

// ─── Risks Tab ────────────────────────────────────────────────────────────────

const PROB_STYLES: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', VERY_HIGH: 'bg-red-100 text-red-700',
};
const IMPACT_STYLES: Record<string, string> = {
  LOW: 'bg-muted text-muted-foreground', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};
const RISK_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700', MITIGATING: 'bg-amber-100 text-amber-700',
  MITIGATED: 'bg-emerald-100 text-emerald-700', ACCEPTED: 'bg-muted text-muted-foreground',
  CLOSED: 'bg-muted text-muted-foreground',
};

const emptyRiskForm = {
  title: '', description: '', probability: 'MEDIUM', impact: 'MEDIUM',
  mitigation: '', contingency: '', ownerId: '', status: 'OPEN', dueDate: '',
};

function RisksTab({ projectId, allocations }: { projectId: string; allocations: Allocation[] }) {
  const { user: authUser } = useAuthStore();
  const [risks, setRisks]     = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<{ open: boolean; item?: Risk }>({ open: false });
  const [form, setForm]       = useState(emptyRiskForm);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRisks(await risksApi.getAll(projectId)); } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm(emptyRiskForm); setModal({ open: true }); }
  function openEdit(r: Risk) {
    setForm({
      title: r.title, description: r.description ?? '', probability: r.probability,
      impact: r.impact, mitigation: r.mitigation ?? '', contingency: r.contingency ?? '',
      ownerId: r.ownerId, status: r.status,
      dueDate: r.dueDate ? r.dueDate.slice(0, 10) : '',
    });
    setModal({ open: true, item: r });
  }

  const previewScore = (PW[form.probability] ?? 1) * (IW[form.impact] ?? 1);
  const scoreChip = (s: number) => s >= 10 ? 'bg-red-100 text-red-700' : s >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { ...form, projectId };
      if (!payload.dueDate) delete payload.dueDate;
      if (!payload.description) delete payload.description;
      if (!payload.mitigation) delete payload.mitigation;
      if (!payload.contingency) delete payload.contingency;
      modal.item ? await risksApi.update(modal.item.id, payload) : await risksApi.create(payload);
      setModal({ open: false }); await load();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(', ') : msg || 'Error saving risk');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this risk?')) return;
    await risksApi.remove(id); await load();
  }

  const canEdit = ['ADMIN', 'PM', 'TL'].includes(authUser?.role || '');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Risk Register</h2>
        {canEdit && (
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus size={14} /> New Risk
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex gap-6 flex-wrap">
          <div className="flex-1 min-w-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {['Title', 'Probability', 'Impact', 'Score', 'Owner', 'Status', 'Due Date', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {risks.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition group">
                    <td className="px-3 py-2 font-medium max-w-[200px] truncate">{r.title}</td>
                    <td className="px-3 py-2"><Pill label={r.probability} style={PROB_STYLES[r.probability]} /></td>
                    <td className="px-3 py-2"><Pill label={r.impact} style={IMPACT_STYLES[r.impact]} /></td>
                    <td className="px-3 py-2">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-black', scoreChip(r.riskScore))}>{r.riskScore}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {r.owner ? `${r.owner.firstName ?? ''} ${r.owner.lastName ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-3 py-2"><Pill label={r.status} style={RISK_STATUS_STYLES[r.status]} /></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Pencil size={12} /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {risks.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">No risks logged.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {risks.length > 0 && <RiskHeatMap risks={risks} />}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-semibold text-lg">{modal.item ? 'Edit Risk' : 'New Risk'}</h2>
              <button onClick={() => setModal({ open: false })} className="p-1 rounded hover:bg-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Risk title..." />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none min-h-[60px]"
                  value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Probability *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}>
                    {['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Impact *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.impact} onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}>
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Risk Score:</span>
                <span className={cn('px-2 py-0.5 rounded text-xs font-black', scoreChip(previewScore))}>{previewScore}</span>
                <span className="text-xs text-muted-foreground">{previewScore >= 10 ? '(High/Critical)' : previewScore >= 5 ? '(Medium)' : '(Low)'}</span>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Mitigation</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none min-h-[50px]"
                  value={form.mitigation} onChange={(e) => setForm((f) => ({ ...f, mitigation: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Contingency</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none min-h-[50px]"
                  value={form.contingency} onChange={(e) => setForm((f) => ({ ...f, contingency: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Owner *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.ownerId} onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))}>
                    <option value="">— Select owner —</option>
                    {allocations.map((a) => (
                      <option key={a.user.id} value={a.user.id}>{a.user.firstName} {a.user.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {['OPEN', 'MITIGATING', 'MITIGATED', 'ACCEPTED', 'CLOSED'].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Due Date</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal({ open: false })} className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.ownerId}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Issues Tab ───────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'bg-muted text-muted-foreground', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};
const ISSUE_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-amber-100 text-amber-700',
  ESCALATED: 'bg-red-100 text-red-700', RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-muted text-muted-foreground',
};

const emptyIssueForm = {
  title: '', description: '', severity: 'MEDIUM', status: 'OPEN',
  ownerId: '', raisedById: '', eta: '', resolution: '',
};

function IssuesTab({ projectId, allocations }: { projectId: string; allocations: Allocation[] }) {
  const { user: authUser } = useAuthStore();
  const [issues, setIssues]   = useState<ProjectIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<{ open: boolean; item?: ProjectIssue }>({ open: false });
  const [form, setForm]       = useState(emptyIssueForm);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setIssues(await issuesApi.getAll(projectId)); } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ ...emptyIssueForm, raisedById: authUser?.id ?? '' });
    setModal({ open: true });
  }
  function openEdit(issue: ProjectIssue) {
    setForm({
      title: issue.title, description: issue.description ?? '', severity: issue.severity,
      status: issue.status, ownerId: issue.ownerId, raisedById: issue.raisedById,
      eta: issue.eta ? issue.eta.slice(0, 10) : '', resolution: issue.resolution ?? '',
    });
    setModal({ open: true, item: issue });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { ...form, projectId };
      if (!payload.eta) delete payload.eta;
      if (!payload.description) delete payload.description;
      if (!payload.resolution) delete payload.resolution;
      modal.item ? await issuesApi.update(modal.item.id, payload) : await issuesApi.create(payload);
      setModal({ open: false }); await load();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(', ') : msg || 'Error saving issue');
    } finally { setSaving(false); }
  }

  async function handleEscalate(id: string) {
    if (!confirm('Escalate this issue? The PM and PMO will be notified.')) return;
    try { await issuesApi.escalate(id); await load(); } catch { alert('Failed to escalate issue'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this issue?')) return;
    await issuesApi.remove(id); await load();
  }

  const canEdit = ['ADMIN', 'PM', 'TL'].includes(authUser?.role || '');

  const daysSince = (iso: string) =>
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Issue Register</h2>
        {canEdit && (
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus size={14} /> New Issue
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {['Title', 'Severity', 'Status', 'Owner', 'ETA', 'Age', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-xs font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {issues.map((issue) => {
                const needsEscalate = canEdit &&
                  ['HIGH', 'CRITICAL'].includes(issue.severity) &&
                  !['RESOLVED', 'CLOSED', 'ESCALATED'].includes(issue.status);
                return (
                  <tr key={issue.id} className="hover:bg-muted/20 transition group">
                    <td className="px-3 py-2 font-medium max-w-[220px] truncate">{issue.title}</td>
                    <td className="px-3 py-2"><Pill label={issue.severity} style={SEVERITY_STYLES[issue.severity]} /></td>
                    <td className="px-3 py-2"><Pill label={issue.status.replace('_', ' ')} style={ISSUE_STATUS_STYLES[issue.status]} /></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {issue.owner ? `${issue.owner.firstName ?? ''} ${issue.owner.lastName ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {issue.eta ? new Date(issue.eta).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {daysSince(issue.createdAt)}d
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {needsEscalate && (
                          <button onClick={() => handleEscalate(issue.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold">
                            <Zap size={10} /> Escalate
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(issue)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Pencil size={12} /></button>
                            <button onClick={() => handleDelete(issue.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {issues.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-muted-foreground">No issues logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-semibold text-lg">{modal.item ? 'Edit Issue' : 'New Issue'}</h2>
              <button onClick={() => setModal({ open: false })} className="p-1 rounded hover:bg-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Issue title..." />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none min-h-[60px]"
                  value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Severity</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Owner *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.ownerId} onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))}>
                    <option value="">— Select owner —</option>
                    {allocations.map((a) => (
                      <option key={a.user.id} value={a.user.id}>{a.user.firstName} {a.user.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Raised By</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.raisedById} onChange={(e) => setForm((f) => ({ ...f, raisedById: e.target.value }))}>
                    <option value="">— Select —</option>
                    {allocations.map((a) => (
                      <option key={a.user.id} value={a.user.id}>{a.user.firstName} {a.user.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ETA</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={form.eta} onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Resolution</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none min-h-[50px]"
                  value={form.resolution} onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal({ open: false })} className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.ownerId}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dependencies Tab ─────────────────────────────────────────────────────────

const DEP_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700', BLOCKED: 'bg-red-100 text-red-700',
};

const emptyDepForm = {
  title: '', description: '', type: 'INTERNAL', fromTaskId: '', toTaskId: '',
  externalRef: '', ownerId: '', status: 'OPEN', dueDate: '',
};

interface SimpleTask { id: string; title: string }

function DependenciesTab({ projectId, allocations }: { projectId: string; allocations: Allocation[] }) {
  const { user: authUser } = useAuthStore();
  const [deps, setDeps]       = useState<ProjectDependency[]>([]);
  const [tasks, setTasks]     = useState<SimpleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<{ open: boolean; item?: ProjectDependency }>({ open: false });
  const [form, setForm]       = useState(emptyDepForm);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depsData, tasksData] = await Promise.all([
        dependenciesApi.getAll(projectId),
        import('@/lib/api').then(({ default: api }) =>
          api.get<SimpleTask[]>(`/tasks?projectId=${projectId}`).then((r) => r.data)
        ),
      ]);
      setDeps(depsData); setTasks(tasksData);
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm(emptyDepForm); setModal({ open: true }); }
  function openEdit(d: ProjectDependency) {
    setForm({
      title: d.title, description: d.description ?? '', type: d.type,
      fromTaskId: d.fromTaskId ?? '', toTaskId: d.toTaskId ?? '',
      externalRef: d.externalRef ?? '', ownerId: d.ownerId,
      status: d.status, dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
    });
    setModal({ open: true, item: d });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { ...form, projectId };
      if (!payload.dueDate) delete payload.dueDate;
      if (!payload.description) delete payload.description;
      if (!payload.fromTaskId) delete payload.fromTaskId;
      if (!payload.toTaskId) delete payload.toTaskId;
      if (!payload.externalRef) delete payload.externalRef;
      modal.item ? await dependenciesApi.update(modal.item.id, payload) : await dependenciesApi.create(payload);
      setModal({ open: false }); await load();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(', ') : msg || 'Error saving dependency');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this dependency?')) return;
    await dependenciesApi.remove(id); await load();
  }

  const canEdit = ['ADMIN', 'PM', 'TL'].includes(authUser?.role || '');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Dependency Register</h2>
        {canEdit && (
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus size={14} /> New Dependency
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {['Title', 'Type', 'Dependency Link', 'Owner', 'Status', 'Due Date', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-xs font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {deps.map((d) => (
                <tr key={d.id} className="hover:bg-muted/20 transition group">
                  <td className="px-3 py-2">
                    <div className="font-medium max-w-[180px] truncate">{d.title}</div>
                    {d.externalRef && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{d.externalRef}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', d.type === 'EXTERNAL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}>
                      {d.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {d.fromTask && d.toTask ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium truncate max-w-[80px]">{d.fromTask.title}</span>
                        <ArrowRight size={10} className="text-muted-foreground flex-shrink-0" />
                        <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium truncate max-w-[80px]">{d.toTask.title}</span>
                      </div>
                    ) : d.fromTask ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">From: {d.fromTask.title}</span>
                    ) : d.toTask ? (
                      <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">To: {d.toTask.title}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {d.owner ? `${d.owner.firstName ?? ''} ${d.owner.lastName ?? ''}`.trim() : '—'}
                  </td>
                  <td className="px-3 py-2"><Pill label={d.status.replace('_', ' ')} style={DEP_STATUS_STYLES[d.status]} /></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {deps.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-muted-foreground">No dependencies logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-semibold text-lg">{modal.item ? 'Edit Dependency' : 'New Dependency'}</h2>
              <button onClick={() => setModal({ open: false })} className="p-1 rounded hover:bg-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Dependency title..." />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none min-h-[60px]"
                  value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    {['INTERNAL', 'EXTERNAL'].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'BLOCKED'].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">From Task</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.fromTaskId} onChange={(e) => setForm((f) => ({ ...f, fromTaskId: e.target.value }))}>
                    <option value="">— None —</option>
                    {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">To Task</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.toTaskId} onChange={(e) => setForm((f) => ({ ...f, toTaskId: e.target.value }))}>
                    <option value="">— None —</option>
                    {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">External Reference</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={form.externalRef} onChange={(e) => setForm((f) => ({ ...f, externalRef: e.target.value }))} placeholder="JIRA-123, vendor ticket, etc." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Owner *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.ownerId} onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))}>
                    <option value="">— Select owner —</option>
                    {allocations.map((a) => (
                      <option key={a.user.id} value={a.user.id}>{a.user.firstName} {a.user.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Due Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal({ open: false })} className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.ownerId}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Planning Tab ─────────────────────────────────────────────────────────────

const WBS_LEVEL_STYLES: Record<string, string> = {
  PHASE:   'bg-purple-100 text-purple-700',
  MODULE:  'bg-blue-100 text-blue-700',
  TASK:    'bg-muted text-muted-foreground',
  SUBTASK: 'bg-muted text-muted-foreground',
};

const DELTA_STYLES: Record<string, string> = {
  DELAYED:  'bg-orange-100 text-orange-700',
  AHEAD:    'bg-emerald-100 text-emerald-700',
  ON_TRACK: 'bg-blue-100 text-blue-700',
  ADDED:    'bg-green-100 text-green-700',
  REMOVED:  'bg-red-100 text-red-700 line-through',
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value.toFixed(0)}%</span>
    </div>
  );
}

type WbsTreeRow = WbsTask & { subRows?: WbsTreeRow[] };

function buildWbsTree(tasks: WbsTask[]): WbsTreeRow[] {
  const childrenByParent = new Map<string, WbsTask[]>();
  for (const task of tasks) {
    const key = task.parentId ?? '__root__';
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(task);
  }
  const attach = (list: WbsTask[]): WbsTreeRow[] =>
    list.map((task) => {
      const children = childrenByParent.get(task.id);
      return children?.length ? { ...task, subRows: attach(children) } : { ...task };
    });
  return attach(childrenByParent.get('__root__') ?? []);
}

function buildWbsColumns(): ColumnDef<WbsTreeRow>[] {
  return [
    {
      id: 'task',
      header: 'Task',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" style={{ paddingLeft: `${row.depth * 16}px` }}>
          {row.getCanExpand() ? (
            <button
              onClick={row.getToggleExpandedHandler()}
              className="p-0.5 rounded hover:bg-secondary"
            >
              {row.getIsExpanded() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-4 inline-block" />
          )}
          {row.original.isCritical && <Flame size={12} className="text-red-500 flex-shrink-0" />}
          <span className={cn('font-medium text-sm', row.original.isCritical && 'text-red-700')}>{row.original.title}</span>
        </div>
      ),
    },
    {
      id: 'level',
      header: 'Level',
      cell: ({ row }) =>
        row.original.wbsLevel ? (
          <span className={cn('px-1.5 py-0.5 rounded text-xs font-bold', WBS_LEVEL_STYLES[row.original.wbsLevel] ?? 'bg-muted text-muted-foreground')}>
            {row.original.wbsLevel}
          </span>
        ) : null,
    },
    {
      id: 'planStart',
      header: 'Plan Start',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.plannedStart ? new Date(row.original.plannedStart).toLocaleDateString('en-IN') : '—'}
        </span>
      ),
    },
    {
      id: 'planEnd',
      header: 'Plan End',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.plannedEnd ? new Date(row.original.plannedEnd).toLocaleDateString('en-IN') : '—'}
        </span>
      ),
    },
    {
      id: 'planHours',
      header: 'Plan Hrs',
      cell: ({ row }) => <span className="text-xs text-right text-muted-foreground block">{row.original.plannedHours ?? '—'}</span>,
    },
    {
      id: 'dailyEffort',
      header: 'Hrs/Day',
      cell: ({ row }) => (
        <span
          className="text-xs text-right text-muted-foreground block"
          title={row.original.workingDays ? `Across ${row.original.workingDays} working days` : undefined}
        >
          {row.original.dailyEffort ?? '—'}
        </span>
      ),
    },
    {
      id: 'actualHours',
      header: 'Actual Hrs',
      cell: ({ row }) => <span className="text-xs text-right text-muted-foreground block">{row.original.actualEffort ?? '—'}</span>,
    },
    {
      id: 'progress',
      header: 'Progress',
      cell: ({ row }) => <ProgressBar value={row.original.progressPct ?? 0} />,
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.assignee ? `${row.original.assignee.firstName ?? ''} ${row.original.assignee.lastName ?? ''}`.trim() : '—'}
        </span>
      ),
    },
    {
      id: 'cr',
      header: 'CR',
      cell: ({ row }) =>
        row.original.changeRequest ? (
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-primary tracking-tighter">{row.original.changeRequest.crCode}</span>
            <span className="text-[9px] font-bold opacity-60 uppercase">{row.original.changeRequest.status}</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground opacity-30">—</span>
        ),
    },
    {
      id: 'critical',
      header: () => <span>🔥</span>,
      cell: ({ row }) => (
        <div className="text-center">{row.original.isCritical && <Flame size={14} className="text-red-500 mx-auto" />}</div>
      ),
    },
  ];
}

function WbsTable({ tasks }: { tasks: WbsTask[] }) {
  const tableId = useId();
  const data = useMemo(() => buildWbsTree(tasks), [tasks]);
  const columns = useMemo(() => buildWbsColumns(), []);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  // Reset to first page when the underlying task set changes.
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [tasks]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSubRows: (row) => row.subRows,
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    // Keep a task and its children together on one page instead of splitting
    // the page purely by flattened row count.
    paginateExpandedRows: false,
    state: { expanded, pagination },
  });

  const total = table.getPrePaginationRowModel().rows.length;
  const { pageIndex, pageSize } = pagination;
  const pageStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/30 border-b hover:bg-muted/30">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="px-3 py-2 text-xs font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No tasks yet. Create tasks with WBS levels and planned dates.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn('hover:bg-muted/20 transition group', row.original.isCritical && 'bg-red-50/50')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination bar — only shown when there is data */}
      {total > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t bg-muted/5">
          <div className="flex items-center gap-2">
            <Label htmlFor={`${tableId}-rpp`} className="text-xs text-muted-foreground whitespace-nowrap">
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}
            >
              <SelectTrigger id={`${tableId}-rpp`} className="h-8 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-xs text-muted-foreground text-center sm:text-left">
            {pageStart}–{pageEnd} of {total} top-level tasks
          </span>

          <Pagination className="w-auto justify-end">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronFirst size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  <ChevronRight size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
                  <ChevronLast size={14} />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

function GanttChart({ tasks, projectStart, projectEnd }: { tasks: WbsTask[]; projectStart: string; projectEnd?: string }) {
  const today = new Date();
  const start = new Date(projectStart);
  const end = projectEnd ? new Date(projectEnd) : new Date(start.getTime() + 90 * 86400000);
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return null;

  const pct = (date: Date) => Math.max(0, Math.min(100, ((date.getTime() - start.getTime()) / totalMs) * 100));
  const todayPct = pct(today);

  const chartTasks = tasks.filter((t) => t.plannedStart && t.plannedEnd);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px] space-y-0">
        <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted/30">
          <span className="text-xs font-black text-muted-foreground uppercase tracking-widest w-48 flex-shrink-0">Task</span>
          <div className="flex-1 relative h-4">
            <span className="text-xs text-muted-foreground absolute left-0">{start.toLocaleDateString('en-IN')}</span>
            <span className="text-xs text-muted-foreground absolute right-0">{end.toLocaleDateString('en-IN')}</span>
          </div>
        </div>
        {chartTasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No tasks with planned dates to show.</p>
        )}
        {chartTasks.map((t) => {
          const barStart = pct(new Date(t.plannedStart!));
          const barEnd = pct(new Date(t.plannedEnd!));
          const barWidth = Math.max(barEnd - barStart, 0.5);
          return (
            <div key={t.id} className="flex items-center gap-2 px-2 py-1 border-b hover:bg-muted/10 transition">
              <div className="w-48 flex-shrink-0 flex items-center gap-1">
                {t.isCritical && <Flame size={10} className="text-red-500 flex-shrink-0" />}
                <span className={cn('text-xs truncate', t.isCritical && 'text-red-600 font-medium')}>{t.title}</span>
              </div>
              <div className="flex-1 relative h-5">
                <div className="absolute inset-y-1 rounded" style={{
                  left: `${barStart}%`,
                  width: `${barWidth}%`,
                  backgroundColor: t.isCritical ? '#ef4444' : 'hsl(var(--primary))',
                  opacity: 0.85,
                }} />
                {todayPct >= 0 && todayPct <= 100 && (
                  <div className="absolute inset-y-0 w-px bg-amber-500 opacity-70" style={{ left: `${todayPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-2 px-2 py-1 mt-1 text-xs text-muted-foreground">
          <span className="w-48 flex-shrink-0" />
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-primary opacity-80" /> Task</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-red-500 opacity-80" /> Critical</span>
          <span className="flex items-center gap-1"><span className="inline-block w-px h-3 bg-amber-500" /> Today</span>
        </div>
      </div>
    </div>
  );
}

function PlanningTab({ projectId, project }: { projectId: string; project: Project }) {
  const { user: authUser } = useAuthStore();
  const canEdit = ['ADMIN', 'PM', 'TL'].includes(authUser?.role || '');

  const [tasks, setTasks]             = useState<WbsTask[]>([]);
  const [baselines, setBaselines]     = useState<Baseline[]>([]);
  const [crs, setCrs]                 = useState<ChangeRequest[]>([]);
  const [diffData, setDiffData]       = useState<BaselineDiffEntry[] | null>(null);
  const [diffBaselineId, setDiffBaselineId] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks]   = useState(true);
  const [loadingBase, setLoadingBase]     = useState(true);
  const [capturingLabel, setCapturingLabel] = useState('');
  const [showCapture, setShowCapture]   = useState(false);
  const [capturing, setCapturing]       = useState(false);
  const [view, setView]                 = useState<'wbs' | 'gantt'>('wbs');
  const [showWbsModal, setShowWbsModal] = useState(false);
  const [showWbsUpload, setShowWbsUpload] = useState(false);
  const [wbsForm, setWbsForm]           = useState({
    title: '', wbsLevel: 'TASK', parentId: '', plannedStart: '', plannedEnd: '', plannedHours: '', assigneeId: '', crId: '', phase: ''
  });

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const { data } = await api.get<WbsTask[]>(`/tasks?projectId=${projectId}`);
      setTasks(data);
    } finally { setLoadingTasks(false); }
  }, [projectId]);

  const loadBaselines = useCallback(async () => {
    setLoadingBase(true);
    try { setBaselines(await baselinesApi.getAll(projectId)); } finally { setLoadingBase(false); }
  }, [projectId]);

  const loadCrs = useCallback(async () => {
    try {
      const data = await changeRequestsApi.getAll(projectId);
      setCrs(data.filter((cr: ChangeRequest) => !['CLOSED', 'DEFERRED', 'ON-HOLD', 'ON_HOLD'].includes(cr.status)));
    } catch (e) { console.error(e); }
  }, [projectId]);

  useEffect(() => { loadTasks(); loadBaselines(); loadCrs(); }, [loadTasks, loadBaselines, loadCrs]);

  async function handleCapture() {
    if (!capturingLabel.trim()) return;
    setCapturing(true);
    try {
      await baselinesApi.capture(projectId, capturingLabel.trim());
      setCapturingLabel(''); setShowCapture(false);
      await loadBaselines();
    } catch { alert('Failed to capture baseline'); }
    finally { setCapturing(false); }
  }

  async function handleCompare(id: string) {
    if (diffBaselineId === id) { setDiffData(null); setDiffBaselineId(null); return; }
    try {
      const data = await baselinesApi.compare(id);
      setDiffData(data); setDiffBaselineId(id);
    } catch { alert('Failed to load comparison'); }
  }

  async function handleAddWbs() {
    try {
      const payload = {
        ...wbsForm,
        projectId,
        plannedHours: Number(wbsForm.plannedHours) || 0,
        plannedStart: wbsForm.plannedStart || undefined,
        plannedEnd: wbsForm.plannedEnd || undefined,
        parentId: wbsForm.parentId || undefined,
        assigneeId: wbsForm.assigneeId || undefined,
        crId: wbsForm.crId || undefined,
        phase: wbsForm.phase || undefined,
      };
      await api.post('/tasks', payload);
      setShowWbsModal(false);
      setWbsForm({ title: '', wbsLevel: 'TASK', parentId: '', plannedStart: '', plannedEnd: '', plannedHours: '', assigneeId: '', crId: '', phase: '' });
      loadTasks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create WBS item');
    }
  }

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Planning — WBS &amp; Baselines</h2>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowWbsModal(true)} className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-colors">
                <Plus size={12} /> Add Item
              </button>
              <button onClick={() => setShowWbsUpload(true)} className="flex items-center gap-1 px-3 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-black uppercase tracking-widest hover:bg-muted/80 transition-colors">
                <Upload size={12} /> Upload WBS
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-1 border rounded-lg p-0.5">
          <button onClick={() => setView('wbs')} className={cn('px-3 py-1 text-xs rounded font-medium transition-colors', view === 'wbs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <ListTodo size={12} className="inline mr-1" />WBS
          </button>
          <button onClick={() => setView('gantt')} className={cn('px-3 py-1 text-xs rounded font-medium transition-colors', view === 'gantt' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <BarChart2 size={12} className="inline mr-1" />Gantt
          </button>
        </div>
      </div>

      {/* WBS Tree */}
      {view === 'wbs' && (
        <div className="border rounded-xl overflow-hidden">
          {loadingTasks ? (
            <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
          ) : (
            <WbsTable tasks={tasks} />
          )}
        </div>
      )}

      {/* Gantt Chart */}
      {view === 'gantt' && (
        <div className="border rounded-xl overflow-hidden p-2">
          {loadingTasks ? (
            <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
          ) : (
            <GanttChart tasks={tasks} projectStart={project.startDate} projectEnd={project.endDate} />
          )}
        </div>
      )}

      {/* Baselines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Baselines</h3>
          {canEdit && (
            <button onClick={() => setShowCapture((s) => !s)} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <Plus size={14} /> Capture Baseline
            </button>
          )}
        </div>

        {showCapture && (
          <div className="border rounded-xl p-4 bg-muted/10 flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Baseline Label</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder='e.g. "Initial Baseline" or "Rebaseline v2"'
                value={capturingLabel}
                onChange={(e) => setCapturingLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
              />
            </div>
            <button onClick={handleCapture} disabled={capturing || !capturingLabel.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
              {capturing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </button>
            <button onClick={() => setShowCapture(false)} className="px-3 py-2 text-sm rounded-lg border hover:bg-secondary">Cancel</button>
          </div>
        )}

        {loadingBase ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : baselines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 border rounded-xl border-dashed">No baselines captured yet.</p>
        ) : (
          <div className="border rounded-xl divide-y overflow-hidden">
            {baselines.map((b) => (
              <div key={b.id}>
                <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black bg-primary/10 text-primary px-2 py-0.5 rounded">v{b.version}</span>
                    <span className="text-sm font-medium">{b.label}</span>
                    <span className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {b.createdBy && <span className="text-xs text-muted-foreground">by {b.createdBy.firstName} {b.createdBy.lastName}</span>}
                  </div>
                  <button onClick={() => handleCompare(b.id)}
                    className={cn('px-3 py-1 text-xs rounded-lg font-medium border transition-colors', diffBaselineId === b.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-secondary')}>
                    {diffBaselineId === b.id ? 'Hide Diff' : 'Compare'}
                  </button>
                </div>

                {diffBaselineId === b.id && diffData && (
                  <div className="border-t bg-muted/5 px-4 py-3">
                    {diffData.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No differences — project is on track.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              {['Task', 'Field', 'Baseline', 'Current', 'Delta'].map((h) => (
                                <th key={h} className="px-2 py-1.5 text-left font-bold text-muted-foreground uppercase tracking-wide text-xs">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {diffData.map((d, i) => (
                              <tr key={i} className={cn('hover:bg-muted/10', d.deltaType === 'REMOVED' && 'opacity-60')}>
                                <td className={cn('px-2 py-1.5 font-medium', d.deltaType === 'REMOVED' && 'line-through')}>{d.title}</td>
                                <td className="px-2 py-1.5 text-muted-foreground capitalize">{d.field}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">{String(d.baselineValue ?? '—')}</td>
                                <td className="px-2 py-1.5">{String(d.currentValue ?? '—')}</td>
                                <td className="px-2 py-1.5">
                                  <span className={cn('px-1.5 py-0.5 rounded font-bold', DELTA_STYLES[d.deltaType])}>{d.deltaType}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <WbsUploadDialog
        open={showWbsUpload}
        onClose={() => setShowWbsUpload(false)}
        projectId={projectId}
        onImported={loadTasks}
      />
      {/* WBS Creation Modal */}
      {showWbsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card border rounded-xl p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-black text-sm uppercase tracking-tight">Add WBS Item</h2>
              <button onClick={() => setShowWbsModal(false)}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Title *</label>
                <input required className="w-full border rounded-lg px-4 py-2.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={wbsForm.title} onChange={(e) => setWbsForm({ ...wbsForm, title: e.target.value })} placeholder="Item title..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Level</label>
                  <select className="w-full border rounded-lg px-3 py-2.5 text-xs bg-background focus:outline-none" value={wbsForm.wbsLevel} onChange={(e) => setWbsForm({ ...wbsForm, wbsLevel: e.target.value })}>
                    {['PHASE', 'MODULE', 'TASK', 'SUBTASK'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Parent Item</label>
                  <select className="w-full border rounded-lg px-3 py-2.5 text-xs bg-background focus:outline-none" value={wbsForm.parentId} onChange={(e) => setWbsForm({ ...wbsForm, parentId: e.target.value })}>
                    <option value="">-- No Parent --</option>
                    {tasks.filter(t => t.wbsLevel !== 'SUBTASK').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Start Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2.5 text-xs bg-background focus:outline-none" value={wbsForm.plannedStart} onChange={(e) => setWbsForm({ ...wbsForm, plannedStart: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">End Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2.5 text-xs bg-background focus:outline-none" value={wbsForm.plannedEnd} onChange={(e) => setWbsForm({ ...wbsForm, plannedEnd: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Planned Hrs</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2.5 text-xs bg-background focus:outline-none" value={wbsForm.plannedHours} onChange={(e) => setWbsForm({ ...wbsForm, plannedHours: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Assignee</label>
                  <select className="w-full border rounded-lg px-3 py-2.5 text-xs bg-background focus:outline-none" value={wbsForm.assigneeId} onChange={(e) => setWbsForm({ ...wbsForm, assigneeId: e.target.value })}>
                    <option value="">-- Unassigned --</option>
                    {project.allocations?.map(a => <option key={a.user.id} value={a.user.id}>{a.user.firstName} {a.user.lastName}</option>)}
                  </select>
                </div>
              </div>
              <CRLinkSection
                crId={wbsForm.crId}
                phase={wbsForm.phase}
                crs={crs}
                onCrChange={v => setWbsForm(f => ({ ...f, crId: v, phase: v ? f.phase : '' }))}
                onPhaseChange={v => setWbsForm(f => ({ ...f, phase: v }))}
              />
              <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                <button type="button" onClick={() => setShowWbsModal(false)} className="px-6 py-2 text-xs font-black uppercase tracking-widest border rounded-lg hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleAddWbs} disabled={!wbsForm.title} className="px-8 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-lg hover:opacity-90 disabled:opacity-50 transition-all">
                  Create Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS_CONFIG: { id: Tab; label: string; Icon: React.ElementType; roles?: string[] }[] = [
  { id: 'dashboard',      label: 'Dashboard',        Icon: LayoutDashboard, roles: ['ADMIN', 'PM'] },
  { id: 'tasks',          label: 'Tasks',            Icon: ListTodo },
  { id: 'planning',       label: 'Planning',         Icon: BarChart2,       roles: ['ADMIN', 'PM', 'TL'] },
  { id: 'tickets',        label: 'Tickets',          Icon: TicketIcon },
  { id: 'milestones',     label: 'Milestones',       Icon: Milestone,  roles: ['ADMIN', 'PM'] },
  { id: 'finance',        label: 'Finance',          Icon: Wallet,     roles: ['ADMIN', 'PM'] },
  { id: 'allocations',    label: 'Allocations',      Icon: Users,      roles: ['ADMIN', 'PM', 'TL'] },
  { id: 'risks',          label: 'Risks',            Icon: ShieldAlert, roles: ['ADMIN', 'PM', 'TL'] },
  { id: 'issues',         label: 'Issues',           Icon: AlertCircle },
  { id: 'dependencies',   label: 'Dependencies',     Icon: GitBranch },
  { id: 'changeRequests', label: 'Change Requests',  Icon: Activity },
  { id: 'documents',      label: 'Documents',        Icon: FileText },
];

function ProjectDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const handleTabChange = useCallback((tabId: Tab) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.replace(`?${params.toString()}`);
  }, [router, searchParams]);
  
  const { user } = useAuthStore();
  const filteredTabs = TABS_CONFIG.filter(t => !t.roles || (user?.role ? t.roles.includes(user.role) : false));


  // Initialize tab from query param if valid
  useEffect(() => {
    if (tabParam && ['dashboard', 'tasks', 'planning', 'tickets', 'milestones', 'allocations', 'risks', 'issues', 'dependencies', 'changeRequests', 'documents', 'finance'].includes(tabParam)) {
      // Ensure tab is allowed
      if (filteredTabs.find(t => t.id === tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, [tabParam, filteredTabs]);

  useEffect(() => {
    api.get<Project>(`/projects/${id}`)
      .then(({ data }) => setProject(data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-muted-foreground" /></div>;
  if (!project) return <div className="text-center py-24 text-muted-foreground">Project not found.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/projects')} className="mt-0.5 p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold tracking-tight">{project.name}</h1>
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', project.type === 'DEVELOPMENT' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700')}>
              {project.type}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
              {
                DRAFT: 'bg-muted text-muted-foreground border-border',
                APPROVED: 'bg-purple-50 text-purple-700 border-purple-200',
                ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                ON_HOLD: 'bg-amber-50 text-amber-700 border-amber-200',
                CLOSED: 'bg-blue-50 text-blue-700 border-blue-200',
                ARCHIVED: 'bg-muted text-muted-foreground border-slate-200',
                CANCELLED: 'bg-red-50 text-red-500 border-red-200',
                INACTIVE: 'bg-slate-100 text-slate-600 border-slate-300',
              }[project.status] ?? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {project.status}
            </span>
          </div>
          {project.description && <p className="text-muted-foreground text-xs mt-0.5">{project.description}</p>}
          <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
            {project.client && <span>Client: <span className="font-medium text-foreground">{project.client.clientCode} — {project.client.name}</span></span>}
            {project.pm && <span>PM: <span className="font-medium text-foreground">{project.pm.firstName} {project.pm.lastName}</span></span>}
            {project.methodology && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{project.methodology}</span>}
            {project.isInternal && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Internal</span>}
          </div>
        </div>
      </div>

      {/* Burn-rate & Margin */}
      {(project.budgetCost != null || project.revenue != null) && (
        <div className="flex gap-3 flex-wrap">
          {project.budgetCost != null && <BurnRateWidget projectId={project.id} />}
          {project.revenue != null && <MarginWidget projectId={project.id} />}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 border-b overflow-x-auto">
        {filteredTabs.map(({ id: tabId, label, Icon }) => (
          <button
            key={tabId}
            onClick={() => handleTabChange(tabId as Tab)}
            className={cn(
              'flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === tabId ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard'     && <ProjectInsightsDashboard projectId={project.id} onTabChange={(tab) => handleTabChange(tab as Tab)} />}
      {activeTab === 'tasks'         && <TasksTab projectId={project.id} />}
      {activeTab === 'planning'      && <PlanningTab projectId={project.id} project={project} />}
      {activeTab === 'tickets'       && <TicketsTab projectId={project.id} />}
      {activeTab === 'milestones'    && <MilestonesTab projectId={project.id} />}
      {activeTab === 'finance'       && <ProjectFinanceTab projectId={project.id} billingModel={(project as any).billingModel ?? 'MILESTONE'} />}
      {activeTab === 'allocations'   && <AllocationsTab projectId={project.id} />}
      {activeTab === 'risks'         && <RisksTab projectId={project.id} allocations={project.allocations || []} />}
      {activeTab === 'issues'        && <IssuesTab projectId={project.id} allocations={project.allocations || []} />}
      {activeTab === 'dependencies'  && <DependenciesTab projectId={project.id} allocations={project.allocations || []} />}
      {activeTab === 'changeRequests' && <ChangeRequestsTab projectId={project.id} project={project} />}
      {activeTab === 'documents'     && <DocumentPanel entityType="PROJECT" entityId={project.id} />}
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <ProjectDetailContent params={params} />
    </Suspense>
  );
}
