'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { tasksApi, Task } from '@/lib/tasks-api';
import { taskTypeMasterApi } from '@/lib/task-type-master-api';
import api from '@/lib/api';
import {
  StatusSelect, TaskTypeSelect, AssigneeSelect, EstimatedEffortInput,
  AssigneeOption,
} from '@/components/tasks/fields';
import { Plus, Loader2, X, Check, Trash2, Calendar, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth';

const toDateInput = (d: string | null | undefined) => (d ? d.substring(0, 10) : '');

const statusStyles: Record<string, string> = {
  BACKLOG:   'bg-muted text-muted-foreground',
  WIP:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  QA:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const priorityStyles: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH:     'bg-orange-100 text-orange-700',
  MEDIUM:   'bg-blue-100 text-blue-700',
  LOW:      'bg-muted text-muted-foreground',
};

const STATUS_CYCLE = ['BACKLOG', 'WIP', 'QA', 'COMPLETED'];
const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog', WIP: 'In Progress', QA: 'Review', COMPLETED: 'Done',
};

interface SubtaskPanelProps {
  parentTask: Task;
}

const makeEmptyForm = (parentTask: Task): Partial<Task> => ({
  title: '', description: '', status: 'BACKLOG', priority: 'MEDIUM',
  projectId: parentTask.projectId, assigneeId: '', taskTypeMasterId: '',
  startDate: null, endDate: null, parentId: parentTask.id,
});

export default function SubtaskPanel({ parentTask }: SubtaskPanelProps) {
  const { user: currentUser } = useAuthStore();
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editSubtask, setEditSubtask] = useState<Task | null>(null);
  const [form, setForm] = useState<Partial<Task>>(makeEmptyForm(parentTask));
  const [effortStr, setEffortStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [projectAllocations, setProjectAllocations] = useState<Array<{
    id: string; percentage: number; user: { id: string; firstName?: string; lastName?: string };
  }>>([]);
  const [taskTypes, setTaskTypes] = useState<{ id: string; name: string }[]>([]);
  const [taskTypesLoading, setTaskTypesLoading] = useState(false);

  useEffect(() => {
    api.get(`/allocations?projectId=${parentTask.projectId}`)
      .then(({ data }) => setProjectAllocations(data))
      .catch(() => setProjectAllocations([]));
  }, [parentTask.projectId]);

  useEffect(() => {
    setTaskTypesLoading(true);
    taskTypeMasterApi.getTree()
      .then(types => setTaskTypes(types.filter(t => t.isActive).map(t => ({ id: t.id, name: t.name }))))
      .catch(() => {})
      .finally(() => setTaskTypesLoading(false));
  }, []);

  const fetchSubtasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tasksApi.getTasks(undefined, undefined, parentTask.id);
      setSubtasks(data);
    } catch {
      setError('Failed to load subtasks');
    } finally {
      setLoading(false);
    }
  }, [parentTask.id]);

  useEffect(() => { fetchSubtasks(); }, [fetchSubtasks]);

  const openCreate = () => {
    setEditSubtask(null);
    setForm(makeEmptyForm(parentTask));
    setEffortStr('');
    setIsFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditSubtask(task);
    setForm({
      title: task.title, description: task.description, status: task.status,
      priority: task.priority, projectId: task.projectId, assigneeId: task.assigneeId,
      taskTypeMasterId: task.taskTypeMasterId ?? '', startDate: task.startDate, endDate: task.endDate,
      parentId: parentTask.id,
    });
    setEffortStr(String(task.estimatedEffort ?? ''));
    setIsFormOpen(true);
  };

  const closeForm = () => { setIsFormOpen(false); setEditSubtask(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.projectId) return;

    const parentStart = toDateInput(parentTask.startDate);
    const parentEnd   = toDateInput(parentTask.endDate);
    const subStart    = toDateInput(form.startDate);
    const subEnd      = toDateInput(form.endDate);

    if (parentStart && subStart && subStart < parentStart) {
      setError(`Start date cannot be before parent task start date (${parentStart})`);
      return;
    }
    if (parentEnd && subEnd && subEnd > parentEnd) {
      setError(`End date cannot exceed parent task end date (${parentEnd})`);
      return;
    }

    // Effort ceiling: the subtasks together may not estimate more than the parent
    // task. Mirrors the server rule so the user sees it before saving — the API
    // stays the source of truth. Not applied when the parent has no estimate of
    // its own, since there is then no ceiling to measure against.
    const parentEstimate = Number(parentTask.estimatedEffort);
    const parentPlanned = Number(parentTask.plannedHours);
    const parentEffort =
      Number.isFinite(parentEstimate) && parentEstimate > 0
        ? parentEstimate
        : Number.isFinite(parentPlanned) && parentPlanned > 0
          ? parentPlanned
          : null;
    if (parentEffort !== null) {
      const incoming = effortStr.trim() === '' ? 0 : Number(effortStr);
      const siblingTotal = subtasks
        .filter((s) => s.id !== editSubtask?.id)
        .reduce((sum, s) => {
          const estimate = Number(s.estimatedEffort);
          if (Number.isFinite(estimate) && estimate > 0) return sum + estimate;
          const planned = Number(s.plannedHours);
          return sum + (Number.isFinite(planned) && planned > 0 ? planned : 0);
        }, 0);
      if (Number.isFinite(incoming) && siblingTotal + incoming - parentEffort > 1e-6) {
        setError(
          `Subtask estimates cannot exceed the parent task estimate — parent ${parentEffort}h, ` +
            `existing subtasks ${siblingTotal}h, this subtask ${incoming}h (total ${siblingTotal + incoming}h).`,
        );
        return;
      }
    }
    setError('');

    try {
      setIsSubmitting(true);
      const payload: Partial<Task> = { ...form, parentId: parentTask.id };
      // Subtasks carry no Change Request — the parent owns it. Dropped here and
      // ignored server-side too, so an existing subtask's value is left untouched.
      delete payload.crId;
      delete payload.phase;
      if (!payload.assigneeId) delete payload.assigneeId;
      if (!payload.taskTypeMasterId) delete payload.taskTypeMasterId;
      delete payload.taskType;
      if (effortStr) payload.estimatedEffort = Number(effortStr);
      if (!payload.startDate) delete payload.startDate;
      if (!payload.endDate) delete payload.endDate;
      if (editSubtask) {
        await tasksApi.updateTask(editSubtask.id, payload);
      } else {
        await tasksApi.createTask(payload);
      }
      closeForm();
      fetchSubtasks();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save subtask');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await tasksApi.deleteTask(id);
      setSubtasks(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Failed to delete subtask');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusCycle = async (task: Task) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length];
    setSubtasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
    try {
      await tasksApi.updateTask(task.id, { status: next });
    } catch {
      fetchSubtasks();
    }
  };

  const assigneeOptions: AssigneeOption[] = projectAllocations.map(a => ({
    id: a.user.id,
    label: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''} (${a.percentage}%)`.trim(),
  }));

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/40 border border-border/40">
        <CornerDownRight size={12} className="text-muted-foreground/50 shrink-0" />
        <span className="text-xs text-muted-foreground/60 font-medium shrink-0">Subtasks of:</span>
        <span className="text-xs font-black text-foreground truncate" title={parentTask.title}>
          {parentTask.title}
        </span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">
          {subtasks.length} Subtask{subtasks.length !== 1 ? 's' : ''}
        </span>
        {['ADMIN', 'PM', 'TL'].includes(currentUser?.role || '') && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Plus size={12} /> Add Subtask
          </button>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 bg-destructive/10 text-destructive text-xs rounded-lg">{error}</div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary opacity-40" />
        </div>
      ) : subtasks.length === 0 ? (
        <div className="py-8 text-center text-xs font-black text-muted-foreground/40 uppercase tracking-widest">
          No subtasks yet
        </div>
      ) : (
        <div className="space-y-2">
          {subtasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:border-primary/30 transition-all group"
            >
              {/* Status pill — click to cycle */}
              <button
                type="button"
                title="Click to advance status"
                onClick={() => handleStatusCycle(task)}
                className={cn('px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider shrink-0 cursor-pointer', statusStyles[task.status] || statusStyles.BACKLOG)}
              >
                {STATUS_LABELS[task.status] ?? task.status}
              </button>

              {/* Title */}
              <span
                className="flex-1 text-xs font-bold truncate cursor-pointer hover:text-primary transition-colors"
                onClick={() => openEdit(task)}
              >
                {task.title}
              </span>

              {/* Priority */}
              <span className={cn('px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-wider shrink-0', priorityStyles[task.priority] || priorityStyles.MEDIUM)}>
                {task.priority}
              </span>

              {/* Assignee avatar */}
              {task.assignee && (
                <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center text-xs font-black border shrink-0" title={`${task.assignee.firstName ?? ''} ${task.assignee.lastName ?? ''}`.trim()}>
                  {(task.assignee.firstName?.[0] || '?').toUpperCase()}
                </div>
              )}

              {/* Delete */}
              <button
                type="button"
                onClick={() => handleDelete(task.id)}
                disabled={deletingId === task.id}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all shrink-0"
                title="Delete subtask"
              >
                {deletingId === task.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {isFormOpen && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="flex min-h-full items-center justify-center py-8 px-4">
            <div className="bg-background border rounded-xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">

              <div className="flex justify-between items-center px-6 pt-6 pb-4">
                <div>
                  <h2 className="font-black text-sm uppercase tracking-tight">
                    {editSubtask ? 'Edit Subtask' : 'Add Subtask'}
                  </h2>
                  <div className="flex items-center gap-1 mt-1">
                    <CornerDownRight size={11} className="text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground/60 font-medium">
                      Parent task:
                    </span>
                    <span className="text-xs font-black text-muted-foreground truncate max-w-[280px]" title={parentTask.title}>
                      {parentTask.title}
                    </span>
                  </div>
                </div>
                <button onClick={closeForm} className="p-1 hover:bg-muted rounded-full transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSave} className="px-6 pb-6 space-y-4">
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Title *</label>
                  <input
                    required
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                    value={form.title ?? ''}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Subtask title..."
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[60px]"
                    value={form.description ?? ''}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Details..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block flex items-center gap-1">
                      <Calendar size={11} /> Start Date *
                    </label>
                    <input
                      required
                      type="date"
                      className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                      value={toDateInput(form.startDate)}
                      min={toDateInput(parentTask.startDate) || undefined}
                      max={toDateInput(parentTask.endDate) || undefined}
                      onChange={e => setForm({ ...form, startDate: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block flex items-center gap-1">
                      <Calendar size={11} /> End Date *
                    </label>
                    <input
                      required
                      type="date"
                      className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                      value={toDateInput(form.endDate)}
                      min={toDateInput(form.startDate) || toDateInput(parentTask.startDate) || undefined}
                      max={toDateInput(parentTask.endDate) || undefined}
                      onChange={e => setForm({ ...form, endDate: e.target.value || null })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                    <select
                      className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none"
                      value={form.priority}
                      onChange={e => setForm({ ...form, priority: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <StatusSelect value={form.status || 'BACKLOG'} onChange={v => setForm({ ...form, status: v })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TaskTypeSelect value={form.taskTypeMasterId || ''} onChange={v => setForm({ ...form, taskTypeMasterId: v })} options={taskTypes} loading={taskTypesLoading} />
                  <AssigneeSelect
                    value={form.assigneeId || ''}
                    onChange={v => setForm({ ...form, assigneeId: v })}
                    options={assigneeOptions}
                  />
                </div>

                <EstimatedEffortInput value={effortStr} onChange={setEffortStr} />

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg border hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    {editSubtask ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
