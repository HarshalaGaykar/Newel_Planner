'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import axios from 'axios';
import { operationsApi, TaskEffortStatus, Timesheet, TimesheetEntry } from '@/lib/operations-api';
import { formatDayHeader, formatHours } from '@/lib/timesheet-format';
import { taskTypeMasterApi, TaskType } from '@/lib/task-type-master-api';
import { projectsApi, Project } from '@/lib/projects-api';
import { tasksApi, Task } from '@/lib/tasks-api';
import { useAuthStore } from '@/lib/store/auth';
import {
  Clock, Plus, Trash2, ArrowLeft, Send, AlertCircle, AlertTriangle, Edit2,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import TimesheetEntryEditDialog from '@/components/timesheets/TimesheetEntryEditDialog';
import { useParams, useRouter } from 'next/navigation';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup,
  ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger,
} from '@/components/kibo-ui/combobox';
import {
  type ColumnDef,
  flexRender, getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Entry form is capped at 4 h per single entry.
const ENTRY_HOURS_DATA = Array.from({ length: 5 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, '0')}h`,
}));

const MINUTES_DATA = Array.from({ length: 12 }, (_, i) => ({
  value: String(i * 5),
  label: `${String(i * 5).padStart(2, '0')}m`,
}));

const DONE_TASK_STATUS = 'COMPLETED';

// Radix Select doesn't allow an empty-string item value, so the "no specific
// subtask" choice needs its own sentinel, mapped back to '' in state.
const GENERAL_SUBTASK_VALUE = '__general__';

function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function entryActivityLabel(entry: TimesheetEntry) {
  if (entry.taskSubActivity) {
    return {
      type: entry.taskSubActivity.activity.taskType.name,
      activity: entry.taskSubActivity.activity.name,
      subActivity: entry.taskSubActivity.name,
    };
  }
  if (entry.activityMaster) {
    return {
      type: (entry.taskType as string).replace('_', ' '),
      activity: entry.activityMaster.activity,
      subActivity: entry.activityMaster.subActivity,
    };
  }
  return { type: (entry.taskType as string).replace('_', ' '), activity: '-', subActivity: '' };
}

function formatEntryDate(entry: TimesheetEntry) {
  const raw = entry.date;
  if (!raw) return 'N/A';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildEntryColumns(
  isEditable: boolean,
  onEdit: (entry: TimesheetEntry) => void,
  onDelete: (id: string) => void,
): ColumnDef<TimesheetEntry>[] {
  return [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="font-semibold whitespace-nowrap text-muted-foreground">
          {formatEntryDate(row.original)}
        </span>
      ),
    },
    {
      id: 'project',
      header: 'Project',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.project?.name ?? 'Unknown Project'}
        </span>
      ),
    },
    {
      id: 'task',
      header: 'Task',
      cell: ({ row }) => {
        const task = row.original.task;
        const topLevelTitle = task?.parent?.title ?? task?.title ?? 'Unknown Task';
        return (
          <div>
            <div className="font-medium text-foreground">{topLevelTitle}</div>
            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{row.original.description || '-'}</div>
          </div>
        );
      },
    },
    {
      id: 'subtask',
      header: 'Subtask',
      cell: ({ row }) => {
        const task = row.original.task;
        const subtaskTitle = task?.parent ? task.title : null;
        return (
          <span className={subtaskTitle ? 'font-medium text-foreground' : 'text-muted-foreground'}>
            {subtaskTitle ?? '-'}
          </span>
        );
      },
    },
    {
      id: 'activity',
      header: 'Activity',
      cell: ({ row }) => {
        const { type, activity, subActivity } = entryActivityLabel(row.original);
        return (
          <>
            <div className="text-xs font-bold text-primary mb-0.5">{type}</div>
            <div className="text-sm text-muted-foreground">
              {activity}{subActivity ? ` - ${subActivity}` : ''}
            </div>
          </>
        );
      },
    },
    {
      id: 'hours',
      header: 'Duration',
      cell: ({ row }) => <span className="font-bold">{formatHours(row.original.hours)}</span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        isEditable ? (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(row.original)}
              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit Entry"
            >
              <Edit2 size={18} />
            </button>
            <button
              onClick={() => onDelete(row.original.id)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Entry"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ) : null,
    },
  ];
}

export default function TimesheetEntryPage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const timesheetId = params.id as string;
  const paginationId = useId();

  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypeMasterTree, setTaskTypeMasterTree] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Form state
  const [entryDate, setEntryDate] = useState('');
  // Whether the selected entryDate has a recorded check-in; null while unknown/checking.
  const [checkedInForDate, setCheckedInForDate] = useState<boolean | null>(null);
  const [entryHoursPart, setEntryHoursPart] = useState(0);
  const [entryMinutesPart, setEntryMinutesPart] = useState(0);
  const [hourInput, setHourInput] = useState('');
  const [minuteInput, setMinuteInput] = useState('');
  // Task selection is two-tier: pick a task first (top-level, or a subtask
  // "promoted" here when its own parent isn't in view), then optionally narrow
  // down to one of its subtasks. Picking a subtask is never required.
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedSubtaskId, setSelectedSubtaskId] = useState('');
  const entryTaskId = selectedSubtaskId || selectedTaskId;
  const [entryDescription, setEntryDescription] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [selectedSubActivityId, setSelectedSubActivityId] = useState('');

  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);

  // Done tasks/subtasks are hidden by default (this project's task lists only
  // ever grow, and stale Done items make the picker unusable over time) —
  // this toggle is the escape hatch, e.g. for backdated corrections.
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Task type always comes from the selected top-level task, never the subtask —
  // a subtask is just a finer-grained bucket for logging hours, not a separate
  // type-bearing entity. This is a synchronous local lookup (no network round
  // trip), since `tasks` already carries every task's taskTypeMasterId.
  const selectedTaskTypeId = tasks.find(t => t.id === selectedTaskId)?.taskTypeMasterId ?? '';

  // ── Over-estimate warning ──────────────────────────────────────────────────
  // One request per task/subtask selection (the server sums every entry logged
  // against that task across all timesheets). The projection is recomputed
  // locally as the duration is typed so the banner reacts instantly; the server
  // repeats the check on save and returns its own wording in `effortWarning`.
  const [effortStatus, setEffortStatus] = useState<TaskEffortStatus | null>(null);

  useEffect(() => {
    if (!entryTaskId) return;
    let cancelled = false;
    operationsApi.getTaskEffortStatus(entryTaskId)
      .then((status) => { if (!cancelled) setEffortStatus(status); })
      .catch(() => { if (!cancelled) setEffortStatus(null); });
    return () => { cancelled = true; };
  }, [entryTaskId]);

  const entryTypedHours = entryHoursPart + entryMinutesPart / 60;
  const effortNotice = useMemo(() => {
    // The taskId guard drops a response that arrived for a previously selected
    // task, so a stale status can never show against the new selection.
    if (!effortStatus || effortStatus.taskId !== entryTaskId) return null;
    // Unestimated tasks have nothing to compare against — stay silent.
    if (!effortStatus.applicable || !effortStatus.estimateHours) return null;
    const title = tasks.find(t => t.id === entryTaskId)?.title ?? 'this task';
    const projected = Math.round((effortStatus.loggedHours + entryTypedHours) * 10) / 10;
    const over = Math.round((projected - effortStatus.estimateHours) * 10) / 10;
    if (over <= 0) {
      return {
        over: false,
        text: `${formatHours(effortStatus.loggedHours)} of ${formatHours(effortStatus.estimateHours)} logged against “${title}”.`,
      };
    }
    return {
      over: true,
      text:
        `${formatHours(effortStatus.loggedHours)} already logged against “${title}”, which was estimated at ` +
        `${formatHours(effortStatus.estimateHours)}. This entry takes it to ${formatHours(projected)} — ` +
        `${formatHours(over)} over estimate.`,
    };
  }, [effortStatus, entryTypedHours, entryTaskId, tasks]);

  // A task/subtask already logged against in this timesheet stays visible no
  // matter what — otherwise finishing up paperwork on something just marked
  // Done would strand an existing entry.
  const loggedTaskIds = useMemo(
    () => new Set((timesheet?.entries ?? []).map(e => e.taskId).filter((id): id is string => !!id)),
    [timesheet?.entries],
  );

  // Done is the only reason a task is withheld from the picker — task dates are
  // deliberately NOT considered, so a task can be logged against any week.
  const isTaskSelectable = useCallback((t: Task) => {
    if (loggedTaskIds.has(t.id)) return true;
    return showCompletedTasks || t.status !== DONE_TASK_STATUS;
  }, [loggedTaskIds, showCompletedTasks]);

  // Tier-1 picker options: real top-level tasks, plus any subtask whose own
  // parent didn't come back in `tasks` (e.g. assigned to someone else) — those
  // would otherwise be unreachable, so they're promoted to the top level.
  // Done tasks and subtasks are filtered the same way at both levels.
  const { taskPickerItems, subtasksByTaskId } = useMemo(() => {
    const selectable = tasks.filter(isTaskSelectable);
    const topLevel = selectable.filter(t => !t.parentId);
    const topLevelIds = new Set(topLevel.map(t => t.id));
    const orphanSubtasks = selectable.filter(t => t.parentId && !topLevelIds.has(t.parentId));

    const items = [
      ...topLevel.map(t => ({ id: t.id, label: t.title })),
      ...orphanSubtasks.map(t => ({
        id: t.id,
        label: t.parent ? `${t.title} (subtask of ${t.parent.title})` : t.title,
      })),
    ];

    const byTaskId = new Map<string, Task[]>();
    selectable.forEach(t => {
      if (t.parentId && topLevelIds.has(t.parentId)) {
        byTaskId.set(t.parentId, [...(byTaskId.get(t.parentId) ?? []), t]);
      }
    });

    return { taskPickerItems: items, subtasksByTaskId: byTaskId };
  }, [tasks, isTaskSelectable]);

  const subtaskOptions = subtasksByTaskId.get(selectedTaskId) ?? [];

  // If the current selection falls out of the picker (e.g. it just got marked
  // Done and "show completed" is off, or the toggle changed), clear it rather
  // than silently keeping a hidden task/subtask selected underneath.
  useEffect(() => {
    if (selectedTaskId && !taskPickerItems.some(t => t.id === selectedTaskId)) {
      setSelectedTaskId('');
      setSelectedSubtaskId('');
    } else if (selectedSubtaskId && !subtaskOptions.some(t => t.id === selectedSubtaskId)) {
      setSelectedSubtaskId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskPickerItems, subtaskOptions]);

  // Derived cascade options
  const activeTaskTypes = taskTypeMasterTree.filter(tt => tt.isActive);
  const selectedTaskTypeObj = activeTaskTypes.find(tt => tt.id === selectedTaskTypeId);
  const activeActivities = selectedTaskTypeObj?.activities.filter(a => a.isActive) ?? [];
  const selectedActivityObj = activeActivities.find(a => a.id === selectedActivityId);
  const activeSubActivities = selectedActivityObj?.subActivities.filter(s => s.isActive) ?? [];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tsData, treeData, projectsData] = await Promise.all([
        operationsApi.getTimesheet(timesheetId),
        taskTypeMasterApi.getTree(),
        projectsApi.getAll(),
      ]);
      if (!tsData) throw new Error('Timesheet data is empty');
      setTimesheet(tsData);
      setTaskTypeMasterTree(Array.isArray(treeData) ? treeData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      const todayStr = new Date().toISOString().split('T')[0];
      const startStr = tsData?.startDate ? new Date(tsData.startDate).toISOString().split('T')[0] : todayStr;
      const endStr = tsData?.endDate ? new Date(tsData.endDate).toISOString().split('T')[0] : todayStr;
      const defaultDate = (todayStr >= startStr && todayStr <= endStr) ? todayStr : startStr;
      setEntryDate(defaultDate);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to load timesheet details'));
    } finally {
      setLoading(false);
    }
  }, [timesheetId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  useEffect(() => {
    if (!selectedProjectId || !timesheet?.userId) {
      const timeoutId = window.setTimeout(() => {
        setTasks([]);
        setSelectedTaskId('');
        setSelectedSubtaskId('');
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    let cancelled = false;
    const canViewAll = ['ADMIN', 'PM', 'TL'].includes(authUser?.role ?? '');
    tasksApi.getTasks(selectedProjectId, undefined, undefined, canViewAll ? undefined : timesheet.userId)
      .then(data => {
        if (cancelled) return;
        setTasks(canViewAll ? data : data.filter(t =>
          t.assigneeId === timesheet.userId ||
          (t.taskAssignees?.some(ta => ta.user.id === timesheet.userId) ?? false)
        ));
        setSelectedTaskId('');
        setSelectedSubtaskId('');
      })
      .catch(() => { if (!cancelled) setTasks([]); });
    return () => { cancelled = true; };
  }, [authUser?.role, selectedProjectId, timesheet?.userId]);

  // Task type is derived synchronously above (no fetch) — this effect only
  // resets the activity cascade when the effective task selection changes.
  useEffect(() => {
    setSelectedActivityId('');
    setSelectedSubActivityId('');
  }, [entryTaskId]);

  // Pre-check the selected entry date for a check-in so the form can warn before
  // a round trip to addEntry fails with the same rule.
  useEffect(() => {
    if (!entryDate) {
      setCheckedInForDate(null);
      return;
    }
    let cancelled = false;
    setCheckedInForDate(null);
    operationsApi.getDailySummary(entryDate, getBrowserTimeZone())
      .then((summary) => {
        if (!cancelled) setCheckedInForDate(!!summary.attendance?.checkIn);
      })
      .catch(() => {
        if (!cancelled) setCheckedInForDate(null);
      });
    return () => { cancelled = true; };
  }, [entryDate]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !entryDate || !entryTaskId) return;
    if (checkedInForDate === false) {
      toast.error('Please clock in before filling the timesheet.');
      return;
    }
    if (entryHoursPart === 0 && entryMinutesPart === 0) {
      toast.error('Duration must be greater than 0h 0m');
      return;
    }
    if (entryHoursPart > 4 || (entryHoursPart === 4 && entryMinutesPart > 0)) {
      toast.error('A single entry cannot exceed 4 hours. Please split into multiple entries.');
      return;
    }
    if (!selectedSubActivityId) {
      setError('Please select an Activity and Sub-Activity');
      return;
    }
    try {
      setError('');
      const created = await operationsApi.addEntry(timesheetId, {
        projectId: selectedProjectId,
        date: new Date(entryDate).toISOString(),
        hours: entryHoursPart + entryMinutesPart / 60,
        taskId: entryTaskId,
        taskSubActivityMasterId: selectedSubActivityId,
        description: entryDescription || undefined,
        timeZone: getBrowserTimeZone(),
      });
      // Soft over-estimate warning from the server — the entry is already saved.
      if (created.effortWarning) {
        toast.warning(created.effortWarning);
      }
      setEntryHoursPart(0);
      setEntryMinutesPart(0);
      setHourInput('');
      setMinuteInput('');
      setEntryDescription('');
      // Keep the selected task so user can log another entry against it; only reset activity choices.
      setSelectedActivityId('');
      setSelectedSubActivityId('');
      fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to add entry'));
    }
  };

  const handleDeleteEntry = useCallback(async (id: string) => {
    try {
      await operationsApi.removeEntry(id);
      fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to delete entry'));
    }
  }, [fetchData]);

  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true);
      await operationsApi.submitTimesheet(timesheetId);
      setConfirmSubmitOpen(false);
      fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to submit timesheet'));
    } finally {
      setSubmitting(false);
    }
  };

  const hourOptions = useMemo(() => {
    const q = hourInput.trim();
    return q ? ENTRY_HOURS_DATA.filter(h => h.label.includes(q)) : ENTRY_HOURS_DATA;
  }, [hourInput]);

  const minuteOptions = useMemo(() => {
    const q = minuteInput.trim();
    return q ? MINUTES_DATA.filter(m => m.label.includes(q)) : MINUTES_DATA;
  }, [minuteInput]);

  // Computed before early returns so all hooks below are called unconditionally
  const isEditable = timesheet != null && (timesheet.status === 'DRAFT' || timesheet.status === 'REJECTED');

  const sortedEntries = useMemo(() => (
    [...(timesheet?.entries ?? [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  ), [timesheet?.entries]);

  const entryColumns = useMemo(
    () => buildEntryColumns(isEditable, setEditingEntry, handleDeleteEntry),
    [isEditable, handleDeleteEntry],
  );

  const entryTable = useReactTable({
    data: sortedEntries,
    columns: entryColumns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: { date: false } },
  });

  const entriesByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const row of entryTable.getRowModel().rows) {
      const dateStr = row.original.date.split('T')[0];
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(row);
    }
    return groups;
  }, [entryTable.getRowModel().rows]);
  
  const sortedDates = useMemo(() => Object.keys(entriesByDate).sort(), [entriesByDate]);

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    if (sortedDates.length > 0 && Object.keys(expandedDays).length === 0) {
      const initial: Record<string, boolean> = {};
      sortedDates.forEach(d => initial[d] = true);
      setExpandedDays(initial);
    }
  }, [sortedDates, expandedDays]);

  const toggleDay = (date: string) => {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading timesheet details...</div>;
  if (!timesheet) return <div className="p-8 text-center text-destructive">Timesheet not found.</div>;

  const totalHours = timesheet.entries?.reduce((sum, e) => sum + e.hours, 0) || 0;

  const formatDate = (val: unknown) => {
    if (!val) return 'N/A';
    let dateVal: unknown = val;
    if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
      const record = val as { date?: unknown; entryDate?: unknown; createdAt?: unknown };
      dateVal = record.date ?? record.entryDate ?? record.createdAt;
    }
    if (!dateVal) return 'N/A';
    if (!(dateVal instanceof Date) && typeof dateVal !== 'string' && typeof dateVal !== 'number') return 'N/A';
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const totalRowCount = sortedEntries.length;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 animate-in">
      <button onClick={() => router.push('/timesheets')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft size={16} /> Back to Timesheets
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="text-primary" /> Timesheet Details
          </h1>
          <p className="text-muted-foreground mt-1">
            Week of <span className="font-semibold text-foreground">{formatDate(timesheet.startDate)}</span> to <span className="font-semibold text-foreground">{formatDate(timesheet.endDate)}</span>
          </p>
        </div>
        <div className="text-right">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            timesheet.status === 'DRAFT' ? 'bg-muted text-foreground' :
            timesheet.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
            timesheet.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
            'bg-emerald-100 text-emerald-700'
          }`}>{timesheet.status.replace('_', ' ')}</span>
          <p className="mt-2 text-2xl font-black text-primary">{formatHours(totalHours)} <span className="text-sm font-medium text-muted-foreground">Total</span></p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm font-medium">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {timesheet.status === 'REJECTED' && timesheet.rejectionRemarks && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-2 text-sm font-medium">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div><div className="font-bold">Rejection Remarks</div><p className="mt-1">{timesheet.rejectionRemarks}</p></div>
        </div>
      )}

      {isEditable && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between gap-4">
            <h2 className="font-bold flex items-center gap-2"><Plus size={18} className="text-primary" /> Log New Entry</h2>
            <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground cursor-pointer">
              <Switch checked={showCompletedTasks} onCheckedChange={setShowCompletedTasks} />
              Show completed tasks
            </Label>
          </div>
          <form onSubmit={handleAddEntry} className="p-6 space-y-4">

            {/* Row 1: Project / Date / Task / Duration */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Project *</label>
                <Combobox
                  data={projects.map(p => ({ value: p.id, label: p.name }))}
                  type="project"
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <ComboboxTrigger className="w-full h-10 justify-between text-sm font-normal" />
                  <ComboboxContent>
                    <ComboboxInput />
                    <ComboboxEmpty>No projects found.</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxGroup>
                        {projects.map(p => (
                          <ComboboxItem key={p.id} value={p.id} keywords={[p.name]}>{p.name}</ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input type="date" required value={entryDate}
                  min={timesheet.startDate ? new Date(timesheet.startDate).toISOString().split('T')[0] : undefined}
                  max={timesheet.endDate ? new Date(timesheet.endDate).toISOString().split('T')[0] : undefined}
                  onChange={e => setEntryDate(e.target.value)}
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {checkedInForDate === false && (
                  <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle size={14} /> Please clock in before filling the timesheet.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Allocated Task *</label>
                <Combobox
                  data={taskPickerItems.map(t => ({ value: t.id, label: t.label }))}
                  type="task"
                  value={selectedTaskId}
                  onValueChange={(v) => { setSelectedTaskId(v); setSelectedSubtaskId(''); }}
                >
                  <ComboboxTrigger className="w-full h-10 justify-between text-sm font-normal" />
                  <ComboboxContent>
                    <ComboboxInput />
                    <ComboboxEmpty>{selectedProjectId ? 'No tasks found.' : 'Select a project first.'}</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxGroup>
                        {taskPickerItems.map(t => (
                          <ComboboxItem key={t.id} value={t.id} keywords={[t.label]}>{t.label}</ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duration *</label>
                <div className="flex gap-2">
                  <Combobox
                    data={ENTRY_HOURS_DATA}
                    type="hour"
                    value={String(entryHoursPart)}
                    onValueChange={(v) => { setEntryHoursPart(Number(v)); setHourInput(''); }}
                    onOpenChange={(open) => { if (!open) setHourInput(''); }}
                  >
                    <ComboboxTrigger className="w-24 justify-between" />
                    <ComboboxContent shouldFilter={false}>
                      <ComboboxInput value={hourInput} onValueChange={setHourInput} />
                      <ComboboxEmpty />
                      <ComboboxList>
                        <ComboboxGroup>
                          {hourOptions.map(o => (
                            <ComboboxItem key={o.value} value={o.value}>{o.label}</ComboboxItem>
                          ))}
                        </ComboboxGroup>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <Combobox
                    data={MINUTES_DATA}
                    type="minute"
                    value={String(entryMinutesPart)}
                    onValueChange={(v) => { setEntryMinutesPart(Number(v)); setMinuteInput(''); }}
                    onOpenChange={(open) => { if (!open) setMinuteInput(''); }}
                  >
                    <ComboboxTrigger className="w-24 justify-between" />
                    <ComboboxContent shouldFilter={false}>
                      <ComboboxInput value={minuteInput} onValueChange={setMinuteInput} />
                      <ComboboxEmpty />
                      <ComboboxList>
                        <ComboboxGroup>
                          {minuteOptions.map(o => (
                            <ComboboxItem key={o.value} value={o.value}>{o.label}</ComboboxItem>
                          ))}
                        </ComboboxGroup>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              </div>
            </div>

            {/* Optional narrowing to a specific subtask — only shown when the
                selected task actually has subtasks, so the common case (a task
                with no breakdown) never sees this extra field. */}
            {subtaskOptions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Subtask <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Combobox
                    data={[
                      { value: GENERAL_SUBTASK_VALUE, label: 'General (no specific subtask)' },
                      ...subtaskOptions.map(t => ({ value: t.id, label: t.title })),
                    ]}
                    type="subtask"
                    value={selectedSubtaskId || GENERAL_SUBTASK_VALUE}
                    onValueChange={(v) => setSelectedSubtaskId(v === GENERAL_SUBTASK_VALUE ? '' : v)}
                  >
                    <ComboboxTrigger className="w-full h-10 justify-between text-sm font-normal" />
                    <ComboboxContent>
                      <ComboboxInput />
                      <ComboboxEmpty>No subtasks found.</ComboboxEmpty>
                      <ComboboxList>
                        <ComboboxGroup>
                          <ComboboxItem value={GENERAL_SUBTASK_VALUE}>General (no specific subtask)</ComboboxItem>
                          {subtaskOptions.map(t => (
                            <ComboboxItem key={t.id} value={t.id} keywords={[t.title]}>{t.title}</ComboboxItem>
                          ))}
                        </ComboboxGroup>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              </div>
            )}

            {/* Over-estimate warning for the selected task/subtask — soft, never blocks */}
            {effortNotice && (
              <div
                className={
                  effortNotice.over
                    ? 'flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-sm'
                    : 'flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border text-muted-foreground text-sm'
                }
              >
                {effortNotice.over
                  ? <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
                <span>{effortNotice.text}</span>
              </div>
            )}

            {/* Row 2: Activity / Sub-Activity (task type is auto-derived from selected task) */}
            {selectedTaskId && !selectedTaskTypeId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-sm">
                <AlertCircle size={15} className="shrink-0" />
                This task has no task type assigned — please edit the task first to assign a type.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Activity *</label>
                <Combobox
                  data={activeActivities.map(a => ({ value: a.id, label: a.name }))}
                  type="activity"
                  value={selectedActivityId}
                  onValueChange={(v) => { setSelectedActivityId(v); setSelectedSubActivityId(''); }}
                >
                  <ComboboxTrigger
                    disabled={!selectedTaskTypeId}
                    title={selectedTaskTypeId ? undefined : 'Select a task with a type first'}
                    className="w-full h-10 justify-between text-sm font-normal disabled:opacity-50"
                  />
                  <ComboboxContent>
                    <ComboboxInput />
                    <ComboboxEmpty>{selectedTaskTypeId ? 'No activities found.' : 'Select a task with a type first.'}</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxGroup>
                        {activeActivities.map(a => (
                          <ComboboxItem key={a.id} value={a.id} keywords={[a.name]}>{a.name}</ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sub-Activity *</label>
                <Combobox
                  data={activeSubActivities.map(s => ({
                    value: s.id,
                    label: s.description ? `${s.name} — ${s.description}` : s.name,
                  }))}
                  type="sub-activity"
                  value={selectedSubActivityId}
                  onValueChange={setSelectedSubActivityId}
                >
                  <ComboboxTrigger
                    disabled={!selectedActivityId}
                    title={selectedActivityId ? undefined : 'Select an activity first'}
                    className="w-full h-10 justify-between text-sm font-normal disabled:opacity-50"
                  />
                  <ComboboxContent>
                    <ComboboxInput />
                    <ComboboxEmpty>{selectedActivityId ? 'No sub-activities found.' : 'Select an activity first.'}</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxGroup>
                        {activeSubActivities.map(s => (
                          <ComboboxItem key={s.id} value={s.id} keywords={[s.name, s.description ?? '']}>
                            <div className="flex flex-col">
                              <span>{s.name}</span>
                              {s.description && <span className="text-xs text-muted-foreground">{s.description}</span>}
                            </div>
                          </ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>

            {/* Row 3: Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description / Comments</label>
              <textarea value={entryDescription} onChange={e => setEntryDescription(e.target.value)}
                className="w-full flex min-h-15 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="What did you work on?" />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={checkedInForDate === false}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                Log Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Logged Entries */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b flex flex-col gap-2 sm:flex-row sm:items-center bg-muted/10">
          <h2 className="font-bold">Logged Entries</h2>
          {isEditable && (timesheet.entries?.length || 0) > 0 && (
            <button onClick={() => setConfirmSubmitOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 sm:ml-auto">
              <Send size={16} /> Submit Timesheet
            </button>
          )}
        </div>

        {sortedDates.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Clock size={48} className="mb-4 opacity-20" />
              <p>No time logged for this week yet.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedDates.map((dateStr) => {
              const dayRows = entriesByDate[dateStr];
              const dayTotal = timesheet.dailyTotals?.[dateStr] ?? dayRows.reduce((s, r) => s + r.original.hours, 0);
              const isExpanded = expandedDays[dateStr] !== false; // defaults to true

              return (
                <div key={dateStr} className="bg-card">
                  <div 
                    className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => toggleDay(dateStr)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground flex items-center justify-center w-6 h-6 rounded-full hover:bg-muted/50 transition-colors">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider text-foreground">
                        {formatDayHeader(dateStr)}
                      </h3>
                    </div>
                    <div className="font-black text-primary text-sm sm:text-base">
                      {formatHours(dayTotal)}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="border-t bg-muted/5 px-2 sm:px-4 pb-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          {entryTable.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id} className="bg-transparent border-b hover:bg-transparent">
                              {headerGroup.headers.map(header => (
                                <TableHead
                                  key={header.id}
                                  className={cn(
                                    'px-3 sm:px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap',
                                    header.column.id === 'activity' && 'hidden md:table-cell',
                                  )}
                                >
                                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                              ))}
                            </TableRow>
                          ))}
                        </TableHeader>
                        <TableBody>
                          {dayRows.map((row: any) => (
                            <TableRow key={row.id} className="hover:bg-muted/20 transition-colors border-b/50">
                              {row.getVisibleCells().map((cell: any) => (
                                <TableCell
                                  key={cell.id}
                                  className={cn(
                                    'px-3 sm:px-4 py-3',
                                    cell.column.id === 'activity' && 'hidden md:table-cell',
                                  )}
                                >
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={confirmSubmitOpen} onOpenChange={(open) => { if (!submitting) setConfirmSubmitOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit timesheet for approval?</DialogTitle>
            <DialogDescription>
              You are about to submit your timesheet for the week of{' '}
              <span className="font-semibold text-foreground">{formatDate(timesheet.startDate)}</span> –{' '}
              <span className="font-semibold text-foreground">{formatDate(timesheet.endDate)}</span>, totalling{' '}
              <span className="font-semibold text-foreground">{formatHours(totalHours)}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Once submitted, the timesheet is locked for review. You won&apos;t be able to add or edit entries unless it is returned to you for changes.
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(false)}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Send size={16} /> {submitting ? 'Submitting…' : 'Submit Timesheet'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingEntry && (
        <TimesheetEntryEditDialog
          entry={editingEntry}
          timesheet={timesheet}
          projects={projects}
          taskTypeMasterTree={taskTypeMasterTree}
          canViewAll={['ADMIN', 'PM', 'TL'].includes(authUser?.role ?? '')}
          onOpenChange={(open) => { if (!open) setEditingEntry(null); }}
          onSaved={() => {
            setEditingEntry(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
