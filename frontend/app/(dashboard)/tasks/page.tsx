'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { tasksApi, Task, AuditLogEntry } from '@/lib/tasks-api';
import { projectsApi, Project } from '@/lib/projects-api';
import { usersApi } from '@/lib/users-api';
import { changeRequestsApi, ChangeRequest } from '@/lib/change-requests-api';
import { taskTypeMasterApi, TaskType as TaskTypeMasterItem } from '@/lib/task-type-master-api';
import { useProjectStore } from '@/lib/store/project';
import { useAuthStore } from '@/lib/store/auth';
import api from '@/lib/api';
import {
  StatusSelect, TaskTypeSelect, AssigneeMultiSelect, EstimatedEffortInput, CRLinkSection, AssigneeOption,
  DailyEffortField,
} from '@/components/tasks/fields';
import { useHolidayDates } from '@/lib/daily-effort';
import {
  Kanban, Plus, AlertCircle, ArrowLeft,
  Loader2, X, Check, History, Calendar, ListTree, Upload, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TaskHistoryPanel from '@/components/tasks/TaskHistoryPanel';
import SubtaskPanel from '@/components/tasks/SubtaskPanel';
import TaskBulkUploadDialog from '@/components/tasks/TaskBulkUploadDialog';
import {
  KanbanProvider, KanbanBoard, KanbanHeader, KanbanCards, KanbanCard, type DragEndEvent,
} from '@/components/kibo-ui/kanban';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger,
} from '@/components/kibo-ui/combobox';
import { TaskCard } from '@/components/tasks/TaskCard';
import { SearchableSelect } from '@/components/ui/searchable-select';

const toDateInput = (d: string | null | undefined) => (d ? d.substring(0, 10) : '');

const MAX_COMBOBOX_ITEMS = 30;

// Module-level constants — stable references across renders so TaskCard.memo is not defeated
const COLUMNS = [
  { id: 'BACKLOG', title: 'Backlog', color: '#6B7280' },
  { id: 'WIP', title: 'In Progress', color: '#F59E0B' },
  { id: 'QA', title: 'In Review', color: '#8B5CF6' },
  { id: 'COMPLETED', title: 'Done', color: '#10B981' },
] as const;

const kColumns = COLUMNS.map(c => ({ id: c.id, name: c.title, color: c.color }));
const moveColumns = COLUMNS.map(c => ({ id: c.id, title: c.title }));

export default function TasksPage() {
  const { currentProject } = useProjectStore();
  const { user: currentUser } = useAuthStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [crs, setCrs] = useState<ChangeRequest[]>([]);
  const [activeTaskTypes, setActiveTaskTypes] = useState<TaskTypeMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterProjectId, setFilterProjectId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [taskComboboxInput, setTaskComboboxInput] = useState('');
  const [projectInputValue, setProjectInputValue] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editTaskItem, setEditTaskItem] = useState<Task | null>(null);
  const [modalTab, setModalTab] = useState<'details' | 'subtasks' | 'history'>('details');
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '', description: '', status: 'BACKLOG', priority: 'MEDIUM',
    projectId: currentProject?.id || '', assigneeId: '', assigneeIds: [], taskType: '', taskTypeMasterId: '',
    startDate: null, endDate: null,
  });
  const [effortStr, setEffortStr] = useState('');
  const [assignableUsers, setAssignableUsers] = useState<Array<{ id: string; firstName?: string | null; lastName?: string | null }>>([]);
  const [assigneesTouched, setAssigneesTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cap how many cards render per column to keep the DOM small on large boards.
  const COLUMN_PAGE_SIZE = 50;
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  // History state
  const [taskHistory, setTaskHistory] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!newTask.projectId) { setAssignableUsers([]); return; }
    usersApi.getTaskAssignees(newTask.projectId)
      .then(setAssignableUsers)
      .catch(() => setAssignableUsers([]));
  }, [newTask.projectId]);

  // Editable Daily Effort: auto-derived until the user types over it.
  const [dailyEffortText, setDailyEffortText] = useState('');
  const [dailyEffortManual, setDailyEffortManual] = useState(false);

  // Live auto value for the Daily Effort field — mirrors the server derivation.
  const holidayDates = useHolidayDates(
    toDateInput(newTask.startDate) || toDateInput(newTask.plannedStart),
    toDateInput(newTask.endDate) || toDateInput(newTask.plannedEnd),
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const isPmTl = ['PM', 'TL'].includes(currentUser?.role || '');
      const [tasksData, projectsData, crsData, taskTypesData] = await Promise.all([
        isPmTl
          ? tasksApi.getPmTlTasks(filterProjectId || undefined)
          : tasksApi.getTasks(filterProjectId || undefined),
        projectsApi.getAll(),
        changeRequestsApi.getAll(),
        taskTypeMasterApi.getTree(),
      ]);
      setTasks(tasksData);
      setProjects(projectsData);
      setCrs(crsData);
      setActiveTaskTypes(taskTypesData.filter((tt: TaskTypeMasterItem) => tt.isActive));
      if (filterProjectId && !projectsData.some((p: Project) => p.id === filterProjectId)) {
        setFilterProjectId('');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filterProjectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (taskItem?: Task) => {
    const hasAssignedSubtask = !!taskItem && taskItem.assigneeId !== currentUser?.id &&
      taskItem.subTasks?.some(st => st.assigneeId === currentUser?.id);
    setModalTab(hasAssignedSubtask ? 'subtasks' : 'details');
    if (taskItem) {
      setEditTaskItem(taskItem);
      setNewTask({
        title: taskItem.title,
        description: taskItem.description,
        status: taskItem.status,
        priority: taskItem.priority,
        projectId: taskItem.projectId,
        assigneeId: taskItem.assigneeId,
        assigneeIds: taskItem.taskAssignees?.length
          ? taskItem.taskAssignees.map(ta => ta.user.id)
          : (taskItem.assigneeId ? [taskItem.assigneeId] : []),
        taskType: taskItem.taskType,
        taskTypeMasterId: taskItem.taskTypeMasterId ?? '',
        // Fall back to the planned dates (e.g. set by WBS upload) when the actual
        // dates haven't been committed yet — Start/End Date are required fields
        // here, so leaving them blank forced a re-entry of data that was already
        // captured during planning.
        startDate: taskItem.startDate ?? taskItem.plannedStart,
        endDate: taskItem.endDate ?? taskItem.plannedEnd,
        plannedStart: taskItem.plannedStart,
        plannedEnd: taskItem.plannedEnd,
        plannedHours: taskItem.plannedHours,
        complexity: taskItem.complexity,
        progressPct: taskItem.progressPct,
        crId: (taskItem as any).crId ?? null,
        phase: (taskItem as any).phase ?? null,
      });
      setEffortStr(String(taskItem.estimatedEffort ?? ''));
      setDailyEffortManual(taskItem.dailyEffortOverride === true && taskItem.dailyEffort != null);
      setDailyEffortText(
        taskItem.dailyEffortOverride === true && taskItem.dailyEffort != null
          ? String(taskItem.dailyEffort)
          : '',
      );
      setAssigneesTouched(false);
      setTaskHistory([]);
      setHistoryLoading(true);
      tasksApi.getTaskHistory(taskItem.id)
        .then((res) => setTaskHistory(res.data))
        .catch(() => setTaskHistory([]))
        .finally(() => setHistoryLoading(false));
    } else {
      setEditTaskItem(null);
      setNewTask({
        title: '', description: '', status: 'BACKLOG', priority: 'MEDIUM',
        projectId: filterProjectId || currentProject?.id || '',
        assigneeId: '', assigneeIds: [], taskType: '', taskTypeMasterId: '', startDate: null, endDate: null,
      });
      setEffortStr('');
      setDailyEffortText('');
      setDailyEffortManual(false);
      setAssigneesTouched(false);
      setTaskHistory([]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditTaskItem(null);
    setTaskHistory([]);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.projectId) return;
    try {
      setIsSubmitting(true);
      const payload: Partial<Task> = { ...newTask };
      // Backend derives the primary assigneeId from assigneeIds; send the array only.
      if (!editTaskItem || assigneesTouched) {
        payload.assigneeIds = newTask.assigneeIds ?? [];
      } else {
        delete payload.assigneeIds;
      }
      delete payload.assigneeId;
      if (!payload.taskType) delete payload.taskType;
      if (!payload.taskTypeMasterId) delete payload.taskTypeMasterId;
      if (effortStr) payload.estimatedEffort = Number(effortStr);
      // Daily Effort: a hand-typed value wins; empty → let the server derive.
      if (dailyEffortManual && dailyEffortText.trim() !== '') {
        payload.dailyEffort = Number(dailyEffortText);
        payload.dailyEffortOverride = true;
      } else {
        delete payload.dailyEffort;
        payload.dailyEffortOverride = false;
      }
      if (!payload.startDate) delete payload.startDate;
      if (!payload.endDate) delete payload.endDate;
      if (!payload.plannedStart) delete payload.plannedStart;
      if (!payload.plannedEnd) delete payload.plannedEnd;
      if (payload.plannedHours == null) delete payload.plannedHours;
      if (payload.complexity == null) delete payload.complexity;
      if (payload.progressPct == null) delete payload.progressPct;
      if (editTaskItem) {
        await tasksApi.updateTask(editTaskItem.id, payload);
      } else {
        await tasksApi.createTask(payload);
      }
      closeModal();
      fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Returns true if the status change persisted, false if blocked/failed.
  const handleStatusChange = async (taskId: string, newStatus: string): Promise<boolean> => {
    if (newStatus === 'COMPLETED') {
      const task = tasks.find(t => t.id === taskId);
      const pending = task?.subTasks?.filter(st => st.status !== 'COMPLETED') ?? [];
      if (pending.length > 0) {
        setError(`Cannot complete task: ${pending.length} subtask${pending.length !== 1 ? 's are' : ' is'} still pending.`);
        return false;
      }
      if (task?.changeRequest && task.changeRequest.status !== 'CLOSED') {
        setError(`Cannot complete task: linked CR ${task.changeRequest.crCode} must be closed first (status: ${task.changeRequest.status.replace('_', ' ')}).`);
        return false;
      }
    }
    setError('');
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await tasksApi.updateTask(taskId, { status: newStatus });
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update task status.');
      fetchData();
      return false;
    }
  };

  const selectedProject = projects.find(p => p.id === filterProjectId);

  // Top-level tasks, filtered client-side by the search box (over already-fetched data).
  // A subtask normally only surfaces nested inside its parent's "Subtasks" tab — but
  // when it's assigned to the current user (and the parent isn't), that's the only
  // task of theirs on this project, so it needs its own board card or it's invisible
  // to them. The API already returns these rows (buildTaskListWhere's assigneeId OR
  // clause), we just weren't rendering them as cards.
  const topLevelTasks = useMemo(() => tasks.filter(t => !t.parentId
    || t.assigneeId === currentUser?.id
    || t.taskAssignees?.some(ta => ta.user.id === currentUser?.id)
  ), [tasks, currentUser?.id]);
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? topLevelTasks.filter(t => t.id === search || t.title.toLowerCase().includes(q))
      : topLevelTasks;
  }, [topLevelTasks, search]);
  const tasksById = useMemo(() => {
    const m: Record<string, Task> = {};
    for (const t of tasks) m[t.id] = t;
    return m;
  }, [tasks]);
  const comboboxData = useMemo(
    () => topLevelTasks.map(t => ({ value: t.id, label: t.title })),
    [topLevelTasks],
  );

  const projectComboboxData = useMemo(
    () => [{ value: 'ALL', label: 'All Projects' }, ...projects.map(p => ({ value: p.id, label: p.name }))],
    [projects],
  );

  // Options for the New Task dialog's Project field — no "All Projects" entry
  const newTaskProjectOptions = useMemo(
    () => projects.map(p => ({ value: p.id, label: p.name })),
    [projects],
  );

  // Client-side filtered + sliced for the task dropdown — avoids rendering 300+ CommandItems
  const taskDisplayOptions = useMemo(() => {
    const q = taskComboboxInput.trim().toLowerCase();
    const filtered = q
      ? comboboxData.filter(o => o.label.toLowerCase().includes(q))
      : comboboxData;
    return { items: filtered.slice(0, MAX_COMBOBOX_ITEMS), total: filtered.length };
  }, [comboboxData, taskComboboxInput]);

  // Same optimisation for the project dropdown
  const projectDisplayOptions = useMemo(() => {
    const q = projectInputValue.trim().toLowerCase();
    const filtered = q
      ? projectComboboxData.filter(o => o.label.toLowerCase().includes(q))
      : projectComboboxData;
    return { items: filtered.slice(0, MAX_COMBOBOX_ITEMS), total: filtered.length };
  }, [projectComboboxData, projectInputValue]);

  // Kibo kanban is controlled: hold board items in state, synced from filtered tasks.
  type KItem = { id: string; name: string; column: string };
  const [kanbanData, setKanbanData] = useState<KItem[]>([]);
  const kanbanDataRef = useRef<KItem[]>([]);
  const syncKanban = useCallback(() => {
    const items: KItem[] = [];
    for (const col of COLUMNS) {
      const colTasks = filteredTasks.filter(t => t.status === col.id);
      const visible = visibleCounts[col.id] ?? COLUMN_PAGE_SIZE;
      for (const t of colTasks.slice(0, visible)) items.push({ id: t.id, name: t.title, column: t.status });
    }
    kanbanDataRef.current = items;
    setKanbanData(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, visibleCounts]);
  useEffect(() => { syncKanban(); }, [syncKanban]);

  const handleKanbanDataChange = (next: KItem[]) => {
    kanbanDataRef.current = next;
    setKanbanData(next);
  };
  const handleKanbanDragEnd = async (event: DragEndEvent) => {
    const id = String(event.active?.id ?? '');
    const moved = kanbanDataRef.current.find(i => i.id === id);
    const task = tasksById[id];
    if (!moved || !task || moved.column === task.status) return;
    const ok = await handleStatusChange(task.id, moved.column);
    if (!ok) syncKanban(); // revert the optimistic kibo move on block/failure
  };
  const quickMove = async (taskId: string, status: string) => {
    const ok = await handleStatusChange(taskId, status);
    if (!ok) syncKanban();
  };

  // Stable refs so TaskCard.memo isn't defeated by recreated callbacks on every render
  const openModalRef = useRef(openModal);
  openModalRef.current = openModal;
  const stableOpenModal = useCallback((task: Task) => openModalRef.current(task), []);

  const quickMoveRef = useRef(quickMove);
  quickMoveRef.current = quickMove;
  const stableQuickMove = useCallback(
    (taskId: string, status: string) => quickMoveRef.current(taskId, status),
    []
  );

  const columnCount = (colId: string) => filteredTasks.filter(t => t.status === colId).length;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await tasksApi.exportTasks({ projectId: filterProjectId || undefined });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to export tasks');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 animate-in h-full flex flex-col min-h-0">

      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-center gap-4 shrink-0 px-2">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2 leading-tight">
              <Kanban className="text-primary" size={18} />
              Task Board
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedProject ? `Project: ${selectedProject.name}` : 'Global overview'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export — sits before Bulk Upload, which sits before the project filter */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-1.5 border rounded-lg text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export Excel
          </button>

          {['ADMIN', 'PM', 'TL'].includes(currentUser?.role || '') && (
            <button
              onClick={() => setIsBulkUploadOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
            >
              <Upload size={14} /> Bulk Upload
            </button>
          )}

          {/* Project filter — same Combobox UI as task search, always first */}
          <Combobox
            data={projectComboboxData}
            type="project"
            value={filterProjectId || 'ALL'}
            onValueChange={(v) => {
              setFilterProjectId(v === 'ALL' ? '' : v);
              setSearch('');
              setTaskComboboxInput('');
              setProjectInputValue('');
              setVisibleCounts({});
            }}
            onOpenChange={(open) => { if (!open) setProjectInputValue(''); }}
          >
            <ComboboxTrigger className="w-50 justify-between" aria-label="Filter by project" />
            <ComboboxContent shouldFilter={false}>
              <ComboboxInput value={projectInputValue} onValueChange={setProjectInputValue} />
              <ComboboxEmpty />
              <ComboboxList>
                <ComboboxGroup>
                  {projectDisplayOptions.items.map((o) => (
                    <ComboboxItem key={o.value} value={o.value}>{o.label}</ComboboxItem>
                  ))}
                </ComboboxGroup>
              </ComboboxList>
              {projectDisplayOptions.total > MAX_COMBOBOX_ITEMS && (
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Showing {MAX_COMBOBOX_ITEMS} of {projectDisplayOptions.total} — type to refine
                </p>
              )}
            </ComboboxContent>
          </Combobox>

          {/* Task search */}
          <Combobox
            data={comboboxData}
            type="task"
            value={search}
            onValueChange={(v) => { setSearch(v); setTaskComboboxInput(''); }}
            onOpenChange={(open) => { if (!open) setTaskComboboxInput(''); }}
          >
            <ComboboxTrigger className="w-50 justify-between" aria-label="Search tasks" />
            <ComboboxContent shouldFilter={false}>
              <ComboboxInput
                value={taskComboboxInput}
                onValueChange={(v) => { setTaskComboboxInput(v); setSearch(v); }}
              />
              <ComboboxEmpty />
              <ComboboxList>
                <ComboboxGroup>
                  {taskDisplayOptions.items.map((o) => (
                    <ComboboxItem key={o.value} value={o.value}>{o.label}</ComboboxItem>
                  ))}
                </ComboboxGroup>
              </ComboboxList>
              {taskDisplayOptions.total > MAX_COMBOBOX_ITEMS && (
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Showing {MAX_COMBOBOX_ITEMS} of {taskDisplayOptions.total} — type to refine
                </p>
              )}
            </ComboboxContent>
          </Combobox>

          {search && (
            <button
              onClick={() => { setSearch(''); setTaskComboboxInput(''); }}
              aria-label="Clear search"
              className="p-1.5 rounded-lg border text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}

          {['ADMIN', 'PM', 'TL'].includes(currentUser?.role || '') && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium shadow-sm hover:opacity-90 transition-all hover:scale-105"
            >
              <Plus size={14} /> New Task
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-2 px-4 py-2 bg-destructive/10 text-destructive text-xs rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-hidden p-2">
          {COLUMNS.map(col => (
            <div key={col.id} className="flex flex-col rounded-md border bg-secondary">
              <div className="flex items-center gap-2 p-2 text-sm font-semibold">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
                {col.title}
              </div>
              <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-md bg-muted/60" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[calc(100vh-12rem)] min-h-[420px] overflow-x-auto p-2">
          <KanbanProvider
            columns={kColumns}
            data={kanbanData}
            onDataChange={handleKanbanDataChange}
            onDragEnd={handleKanbanDragEnd}
            className="h-full min-w-[960px]"
          >
            {(column) => {
              const total = columnCount(column.id);
              const shown = kanbanData.filter(i => i.column === column.id).length;
              return (
                <KanbanBoard id={column.id} key={column.id}>
                  <KanbanHeader className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-medium">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
                      {column.name}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold opacity-60">{total}</span>
                  </KanbanHeader>
                  <KanbanCards id={column.id}>
                    {(item) => {
                      const task = tasksById[item.id];
                      if (!task) return null;
                      return (
                        <KanbanCard key={item.id} id={item.id} name={item.name} column={item.column}>
                          <TaskCard task={task} columns={moveColumns} onOpen={stableOpenModal} onMove={stableQuickMove} />
                        </KanbanCard>
                      );
                    }}
                  </KanbanCards>
                  {total > shown && (
                    <button
                      onClick={() => setVisibleCounts(prev => ({ ...prev, [column.id]: (prev[column.id] ?? COLUMN_PAGE_SIZE) + COLUMN_PAGE_SIZE }))}
                      className="m-2 rounded-lg border border-dashed py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                    >
                      Load more ({total - shown})
                    </button>
                  )}
                  {total === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30">
                      <Kanban size={24} strokeWidth={1} />
                      <p className="mt-2 text-xs font-semibold">Empty</p>
                    </div>
                  )}
                </KanbanBoard>
              );
            }}
          </KanbanProvider>
        </div>
      )}

      {/* ── Bulk Upload Dialog ── */}
      <TaskBulkUploadDialog
        open={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onImported={fetchData}
      />

      {/* ── Task Modal (Create / Edit) ── */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="flex min-h-full items-center justify-center py-8 px-4">
            <div className={cn('bg-background border rounded-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 transition-all', modalTab === 'history' ? 'max-w-5xl' : 'max-w-2xl', modalTab === 'subtasks' && 'max-w-3xl')}>

              {/* Header */}
              <div className="flex justify-between items-center px-6 pt-6 pb-4">
                <h2 className="font-semibold text-sm">
                  {editTaskItem ? 'Edit Task' : 'Create Task'}
                </h2>
                <button onClick={closeModal} className="p-1 hover:bg-muted rounded-full transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Tabs (only when editing) */}
              {editTaskItem && (
                <div className="flex border-b px-6">
                  {(['details', 'subtasks', 'history'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setModalTab(tab)}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                        modalTab === tab
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab === 'history' && <History size={12} />}
                      {tab === 'subtasks' && <ListTree size={12} />}
                      {tab}
                      {tab === 'subtasks' && editTaskItem.subTasks && editTaskItem.subTasks.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {editTaskItem.subTasks.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Details Tab */}
              {modalTab === 'details' && (
                <form onSubmit={handleSaveTask} className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title *</label>
                    <input
                      required
                      className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                      value={newTask.title ?? ''}
                      onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="Task title..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[60px]"
                      value={newTask.description ?? ''}
                      onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Task details..."
                    />
                  </div>

                  {/* Start Date / End Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <Calendar size={11} /> Start Date *
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={toDateInput(newTask.startDate)}
                        onChange={e => setNewTask({ ...newTask, startDate: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <Calendar size={11} /> End Date *
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={toDateInput(newTask.endDate)}
                        min={toDateInput(newTask.startDate) || undefined}
                        onChange={e => setNewTask({ ...newTask, endDate: e.target.value || null })}
                      />
                    </div>
                  </div>

                  {/* Planned Start / Planned End — the forecast dates (e.g. set by
                      WBS upload), kept separate from the committed Start/End Date above. */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <Calendar size={11} /> Planned Start
                      </label>
                      <input
                        type="date"
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={toDateInput(newTask.plannedStart)}
                        onChange={e => setNewTask({ ...newTask, plannedStart: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <Calendar size={11} /> Planned End
                      </label>
                      <input
                        type="date"
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={toDateInput(newTask.plannedEnd)}
                        min={toDateInput(newTask.plannedStart) || undefined}
                        onChange={e => setNewTask({ ...newTask, plannedEnd: e.target.value || null })}
                      />
                    </div>
                  </div>

                  {/* Planned Hours / Complexity / Progress — planning data captured
                      by WBS upload; editable here so it isn't stranded off-screen. */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Planned Hours</label>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={newTask.plannedHours ?? ''}
                        onChange={e => setNewTask({ ...newTask, plannedHours: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Complexity (1-5)</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={1}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={newTask.complexity ?? ''}
                        onChange={e => setNewTask({ ...newTask, complexity: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Progress %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                        value={newTask.progressPct ?? ''}
                        onChange={e => setNewTask({ ...newTask, progressPct: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project *</label>
                      <SearchableSelect
                        options={newTaskProjectOptions}
                        value={newTask.projectId ?? ''}
                        onValueChange={(projectId) => {
                          setAssigneesTouched(true);
                          setNewTask({ ...newTask, projectId, assigneeIds: [] });
                        }}
                        allLabel="Select Project"
                        searchPlaceholder="Search projects..."
                        className="text-xs h-[30px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
                      <select
                        className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none"
                        value={newTask.priority}
                        onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <StatusSelect value={newTask.status || 'BACKLOG'} onChange={v => setNewTask({ ...newTask, status: v })} />
                    <TaskTypeSelect
                      value={newTask.taskTypeMasterId || ''}
                      onChange={v => setNewTask({ ...newTask, taskTypeMasterId: v })}
                      options={activeTaskTypes}
                    />
                  </div>

                  {editTaskItem && newTask.status === 'COMPLETED' && (() => {
                    const pending = editTaskItem.subTasks?.filter(st => st.status !== 'COMPLETED') ?? [];
                    const cr = editTaskItem.changeRequest;
                    const crBlocked = cr && cr.status !== 'CLOSED';
                    if (!pending.length && !crBlocked) return null;
                    return (
                      <div className="flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 text-amber-700 dark:text-amber-400">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={13} className="shrink-0" />
                          <p className="text-xs font-medium">Cannot mark as completed</p>
                        </div>
                        {pending.length > 0 && (
                          <p className="text-xs pl-5">
                            {pending.length} subtask{pending.length !== 1 ? 's are' : ' is'} still pending — complete them in the Subtasks tab first.
                          </p>
                        )}
                        {crBlocked && (
                          <p className="text-xs pl-5">
                            Linked CR <span className="font-bold">{cr.crCode}</span> must be closed first (current status: {cr.status.replace('_', ' ')}).
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    <AssigneeMultiSelect
                      value={newTask.assigneeIds ?? []}
                      onChange={ids => {
                        setAssigneesTouched(true);
                        setNewTask({ ...newTask, assigneeIds: ids });
                      }}
                      options={assignableUsers.map((u): AssigneeOption => ({
                        id: u.id,
                        label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
                      }))}
                      emptyHint="No allocated resources on this project. Allocate users first."
                    />
                    <EstimatedEffortInput value={effortStr} onChange={setEffortStr} />
                  </div>

                  <DailyEffortField
                    effort={effortStr}
                    startDate={toDateInput(newTask.startDate) || toDateInput(newTask.plannedStart)}
                    endDate={toDateInput(newTask.endDate) || toDateInput(newTask.plannedEnd)}
                    holidayDates={holidayDates}
                    value={dailyEffortText}
                    touched={dailyEffortManual}
                    onChange={(v, t) => { setDailyEffortText(v); setDailyEffortManual(t); }}
                    onReset={() => { setDailyEffortText(''); setDailyEffortManual(false); }}
                  />

                  <CRLinkSection
                    crId={(newTask as any).crId || ''}
                    phase={(newTask as any).phase || ''}
                    crs={crs.filter(cr => cr.projectId === newTask.projectId && ['APPROVED', 'IN_PROGRESS'].includes(cr.status))}
                    onCrChange={v => setNewTask({ ...newTask, crId: v || undefined, phase: v ? (newTask as any).phase : undefined } as any)}
                    onPhaseChange={v => setNewTask({ ...newTask, phase: v || undefined } as any)}
                  />

                  <div className="flex justify-end gap-3 mt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-1.5 text-xs font-medium rounded-lg border hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium shadow-sm hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      {editTaskItem ? 'Save' : 'Create'}
                    </button>
                  </div>
                </form>
              )}

              {/* Subtasks Tab */}
              {modalTab === 'subtasks' && editTaskItem && (
                <div className="p-6">
                  <SubtaskPanel parentTask={editTaskItem} />
                </div>
              )}

              {/* History Tab */}
              {modalTab === 'history' && (
                <div className="flex flex-col p-6 gap-4" style={{ minHeight: '480px' }}>
                  <div className="flex-1 overflow-auto" style={{ maxHeight: '65vh' }}>
                    <TaskHistoryPanel entries={taskHistory} loading={historyLoading} />
                  </div>
                  <div className="flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-1.5 text-xs font-medium rounded-lg border hover:bg-secondary transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
