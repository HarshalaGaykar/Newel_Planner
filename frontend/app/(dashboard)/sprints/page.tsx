'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  AlertCircle, CalendarDays, CheckCircle2, ChevronRight,
  CircleDashed, Flag, Loader2, Play, Plus, RefreshCw,
  Target, Trophy, X, Zap,
} from 'lucide-react';
import { sprintsApi, Sprint, SprintTask, BurndownPoint } from '@/lib/sprints-api';
import { projectsApi, Project } from '@/lib/projects-api';
import { tasksApi } from '@/lib/tasks-api';
import { useProjectStore } from '@/lib/store/project';
import { cn } from '@/lib/utils';

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLUMNS = [
  { key: 'TODO', label: 'To Do', color: 'border-slate-400' },
  { key: 'WIP', label: 'In Progress', color: 'border-blue-500' },
  { key: 'COMPLETED', label: 'Done', color: 'border-emerald-500' },
];

const COLUMN_STATUSES: Record<string, string[]> = {
  TODO: ['TODO', 'BACKLOG'],
  WIP: ['WIP', 'QA'],
  COMPLETED: ['COMPLETED'],
};

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  LOW: 'bg-muted text-muted-foreground',
};

const SPRINT_STATUS_COLOR: Record<string, string> = {
  PLANNED: 'bg-muted text-foreground',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-500',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function daysLeft(end: string) {
  const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  return diff > 0 ? `${diff}d left` : diff === 0 ? 'ends today' : 'ended';
}

// ── task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onDragStart,
}: {
  task: SprintTask;
  onDragStart: (e: React.DragEvent, taskId: string, source: 'board' | 'backlog') => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id, 'board')}
      className="bg-card border border-slate-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <p className="text-[13px] font-medium text-foreground leading-snug mb-2">{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.MEDIUM)}>
          {task.priority}
        </span>
        {task.storyPoints != null && (
          <span className="text-xs bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded">
            {task.storyPoints} pts
          </span>
        )}
        {task.assignee && (
          <span className="ml-auto text-xs text-muted-foreground">
            {task.assignee.firstName} {task.assignee.lastName?.[0]}.
          </span>
        )}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

type Tab = 'board' | 'burndown' | 'velocity';

interface DragState {
  taskId: string;
  source: 'board' | 'backlog';
}

export default function SprintsPage() {
  const { currentProject } = useProjectStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(currentProject?.id || '');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [backlog, setBacklog] = useState<SprintTask[]>([]);
  const [burndown, setBurndown] = useState<BurndownPoint[]>([]);
  const [tab, setTab] = useState<Tab>('board');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showConfirm, setShowConfirm] = useState<'start' | 'complete' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', goal: '', startDate: '', endDate: '', capacity: '',
  });

  // Drag state
  const [drag, setDrag] = useState<DragState | null>(null);

  // ── load projects ──
  useEffect(() => {
    projectsApi.getAll().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentProject?.id) setProjectId(currentProject.id);
  }, [currentProject]);

  // ── load sprints when project changes ──
  const loadSprints = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await sprintsApi.list(projectId);
      setSprints(data);
      const active = data.find((s) => s.status === 'ACTIVE');
      if (active && !selectedSprintId) setSelectedSprintId(active.id);
    } catch {
      setError('Failed to load sprints');
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSprints([]);
    setSelectedSprintId(null);
    setSprint(null);
    loadSprints();
  }, [loadSprints]);

  // ── load sprint detail ──
  const loadSprint = useCallback(async () => {
    if (!selectedSprintId) return;
    setLoading(true);
    try {
      const [s, bd] = await Promise.all([
        sprintsApi.get(selectedSprintId),
        sprintsApi.getBurndown(selectedSprintId).catch(() => []),
      ]);
      setSprint(s);
      setBurndown(bd as BurndownPoint[]);
    } catch {
      setError('Failed to load sprint');
    } finally {
      setLoading(false);
    }
  }, [selectedSprintId]);

  useEffect(() => {
    loadSprint();
  }, [loadSprint]);

  // ── load backlog ──
  const loadBacklog = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await sprintsApi.getBacklog(projectId);
      setBacklog(data);
    } catch {
      setBacklog([]);
    }
  }, [projectId]);

  useEffect(() => {
    loadBacklog();
  }, [loadBacklog, sprint]);

  // ── create sprint ──
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setSubmitting(true);
    try {
      await sprintsApi.create({
        projectId,
        name: createForm.name,
        goal: createForm.goal || undefined,
        startDate: createForm.startDate,
        endDate: createForm.endDate,
        capacity: createForm.capacity ? Number(createForm.capacity) : undefined,
      });
      setShowCreate(false);
      setCreateForm({ name: '', goal: '', startDate: '', endDate: '', capacity: '' });
      await loadSprints();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed to create sprint');
    } finally {
      setSubmitting(false);
    }
  }

  // ── start sprint ──
  async function handleStart() {
    if (!selectedSprintId) return;
    setSubmitting(true);
    try {
      await sprintsApi.start(selectedSprintId);
      setShowConfirm(null);
      await Promise.all([loadSprints(), loadSprint()]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed to start sprint');
    } finally {
      setSubmitting(false);
    }
  }

  // ── complete sprint ──
  async function handleComplete() {
    if (!selectedSprintId) return;
    setSubmitting(true);
    try {
      const summary = await sprintsApi.complete(selectedSprintId);
      setShowConfirm(null);
      alert(
        `Sprint completed!\nVelocity: ${summary.velocity} pts\n` +
        `Completed: ${summary.completed}/${summary.planned} pts\n` +
        `${summary.incompleteTasksMovedToBacklog} tasks moved to backlog`,
      );
      await Promise.all([loadSprints(), loadSprint(), loadBacklog()]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed to complete sprint');
    } finally {
      setSubmitting(false);
    }
  }

  // ── drag and drop ──
  function onDragStart(e: React.DragEvent, taskId: string, source: 'board' | 'backlog') {
    setDrag({ taskId, source });
    e.dataTransfer.effectAllowed = 'move';
  }

  async function onDropColumn(e: React.DragEvent, columnKey: string) {
    e.preventDefault();
    if (!drag) return;
    const targetStatus = columnKey === 'TODO' ? 'TODO' : columnKey === 'WIP' ? 'WIP' : 'COMPLETED';

    if (drag.source === 'backlog' && sprint) {
      // backlog → sprint + set status
      await sprintsApi.addTasks(sprint.id, [drag.taskId]);
      await tasksApi.updateTask(drag.taskId, { status: targetStatus });
    } else {
      // board → board (status change only)
      await tasksApi.updateTask(drag.taskId, { status: targetStatus });
    }
    setDrag(null);
    await Promise.all([loadSprint(), loadBacklog()]);
  }

  async function onDropBacklog(e: React.DragEvent) {
    e.preventDefault();
    if (!drag || drag.source !== 'board' || !sprint) return;
    await sprintsApi.removeTask(sprint.id, drag.taskId);
    setDrag(null);
    await Promise.all([loadSprint(), loadBacklog()]);
  }

  // ── derived ──
  const completedSprints = sprints.filter((s) => s.status === 'COMPLETED').slice(0, 5);

  const capacity = sprint?.capacity ?? (sprint?.tasks?.reduce((s, t) => s + (t.storyPoints ?? 0), 0) ?? 0);
  const completedPts = sprint?.tasks?.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + (t.storyPoints ?? 0), 0) ?? 0;
  const capacityPct = capacity > 0 ? Math.min(100, Math.round((completedPts / capacity) * 100)) : 0;

  // ideal burndown line
  const burndownWithIdeal = burndown.map((p, i) => ({
    ...p,
    ideal: capacity > 0 ? Math.round(capacity * (1 - i / Math.max(burndown.length - 1, 1))) : 0,
  }));

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-slate-50">
      {/* ── Sprint list sidebar ── */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-slate-200 bg-card overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <select
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setSelectedSprintId(null); }}
          >
            <option value="">— select project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-black tracking-widest text-slate-400 uppercase">Sprints</span>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!projectId}
            className="p-1 rounded-lg hover:bg-blue-50 text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {sprints.length === 0 && projectId && (
            <p className="text-xs text-slate-400 px-2 py-4 text-center">No sprints yet</p>
          )}
          {sprints.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSprintId(s.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg transition-colors',
                selectedSprintId === s.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-slate-50',
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground truncate">{s.name}</span>
                {s.status === 'ACTIVE' && <Zap size={10} className="text-emerald-500 shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded uppercase', SPRINT_STATUS_COLOR[s.status])}>
                  {s.status}
                </span>
                <span className="text-xs text-slate-400">{s._count?.tasks ?? 0} tasks</span>
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            <AlertCircle size={14} />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {!projectId && (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-slate-400">
            <Flag size={40} strokeWidth={1} />
            <p className="text-sm">Select a project to view sprints</p>
          </div>
        )}

        {projectId && !selectedSprintId && !loading && (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-slate-400">
            <CircleDashed size={40} strokeWidth={1} />
            <p className="text-sm">Select a sprint from the sidebar</p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Plus size={12} /> New Sprint
            </button>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        )}

        {sprint && !loading && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Sprint header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-200 bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded uppercase', SPRINT_STATUS_COLOR[sprint.status])}>
                      {sprint.status}
                    </span>
                    <h1 className="text-lg font-black tracking-tight text-slate-900 truncate">{sprint.name}</h1>
                  </div>
                  {sprint.goal && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Target size={12} /> {sprint.goal}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={11} />
                      {fmt(sprint.startDate)} – {fmt(sprint.endDate)}
                    </span>
                    {sprint.status === 'ACTIVE' && (
                      <span className="text-amber-600 font-semibold">{daysLeft(sprint.endDate)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Trophy size={11} />
                      {completedPts}/{capacity} pts
                    </span>
                  </div>
                  {/* Capacity bar */}
                  {capacity > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-xs">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${capacityPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{capacityPct}%</span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={loadSprint}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                    title="Refresh"
                  >
                    <RefreshCw size={14} />
                  </button>
                  {sprint.status === 'PLANNED' && (
                    <button
                      onClick={() => setShowConfirm('start')}
                      className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                    >
                      <Play size={12} /> Start Sprint
                    </button>
                  )}
                  {sprint.status === 'ACTIVE' && (
                    <button
                      onClick={() => setShowConfirm('complete')}
                      className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                    >
                      <CheckCircle2 size={12} /> Complete Sprint
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4">
                {(['board', 'burndown', 'velocity'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-colors',
                      tab === t ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Board tab */}
              {tab === 'board' && (
                <>
                  <div className="grid grid-cols-3 gap-4 min-h-[300px]">
                    {STATUS_COLUMNS.map((col) => {
                      const colTasks = (sprint.tasks ?? []).filter((t) =>
                        COLUMN_STATUSES[col.key].includes(t.status),
                      );
                      return (
                        <div
                          key={col.key}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDropColumn(e, col.key)}
                          className={cn(
                            'flex flex-col rounded-xl border-t-4 bg-slate-50 p-3 min-h-[200px]',
                            col.color,
                          )}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black tracking-widest text-muted-foreground uppercase">
                              {col.label}
                            </span>
                            <span className="text-xs bg-card border border-slate-200 text-muted-foreground font-bold px-1.5 py-0.5 rounded-full">
                              {colTasks.length}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 flex-1">
                            {colTasks.map((t) => (
                              <TaskCard key={t.id} task={t} onDragStart={onDragStart} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Backlog section */}
                  <div className="mt-8">
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">Backlog</h2>
                      <span className="text-xs bg-slate-200 text-muted-foreground font-bold px-1.5 py-0.5 rounded-full">{backlog.length}</span>
                      <ChevronRight size={12} className="text-slate-300" />
                      <span className="text-xs text-slate-400">Drag tasks to the board to add to sprint</span>
                    </div>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={onDropBacklog}
                      className={cn(
                        'border border-dashed border-slate-300 rounded-xl p-3 min-h-[80px] transition-colors',
                        drag?.source === 'board' ? 'border-blue-400 bg-blue-50' : 'bg-card',
                      )}
                    >
                      {backlog.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">No backlog items</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {backlog.map((t) => (
                          <TaskCard key={t.id} task={t} onDragStart={(e, id) => onDragStart(e, id, 'backlog')} />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Burndown tab */}
              {tab === 'burndown' && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-4">Burndown Chart</h2>
                  {burndownWithIdeal.length === 0 ? (
                    <p className="text-sm text-slate-400">No burndown data yet — sprint may not have started.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={burndownWithIdeal} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                          formatter={(val, name) => [`${Number(val ?? 0)} pts`, String(name)]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line
                          type="monotone"
                          dataKey="ideal"
                          stroke="#94a3b8"
                          strokeDasharray="6 3"
                          dot={false}
                          name="Ideal"
                          strokeWidth={1.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="remainingPoints"
                          stroke="#3b82f6"
                          dot={{ r: 3, fill: '#3b82f6' }}
                          name="Remaining"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="completedPoints"
                          stroke="#10b981"
                          dot={{ r: 3, fill: '#10b981' }}
                          name="Completed"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* Velocity tab */}
              {tab === 'velocity' && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-4">Velocity Trend (last 5 sprints)</h2>
                  {completedSprints.length === 0 ? (
                    <p className="text-sm text-slate-400">No completed sprints yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={completedSprints.map((s) => ({
                          name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
                          velocity: s.velocity ?? 0,
                          capacity: s.capacity ?? 0,
                        }))}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                          formatter={(val, name) => [`${Number(val ?? 0)} pts`, String(name)]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="capacity" fill="#e2e8f0" name="Capacity" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="velocity" fill="#3b82f6" name="Velocity" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Create Sprint Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-black tracking-tight">New Sprint</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sprint Name *</label>
                <input
                  required
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Sprint 1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Goal</label>
                <input
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={createForm.goal}
                  onChange={(e) => setCreateForm((f) => ({ ...f, goal: e.target.value }))}
                  placeholder="What will be achieved?"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Date *</label>
                  <input
                    required
                    type="date"
                    className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">End Date *</label>
                  <input
                    required
                    type="date"
                    className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Capacity (story points)</label>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={createForm.capacity}
                  onChange={(e) => setCreateForm((f) => ({ ...f, capacity: e.target.value }))}
                  placeholder="e.g. 40"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  Create Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            {showConfirm === 'start' ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 rounded-xl"><Play size={18} className="text-emerald-600" /></div>
                  <h2 className="text-sm font-black">Start Sprint?</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Starting <strong>{sprint?.name}</strong> will make it the active sprint.
                  Only one sprint can be active per project at a time.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowConfirm(null)} className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={submitting}
                    className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 size={12} className="animate-spin" />}
                    Start Sprint
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-xl"><CheckCircle2 size={18} className="text-blue-600" /></div>
                  <h2 className="text-sm font-black">Complete Sprint?</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Completing <strong>{sprint?.name}</strong> will:
                </p>
                <ul className="text-sm text-muted-foreground mb-6 space-y-1 list-disc list-inside">
                  <li>Calculate and save velocity</li>
                  <li>Move incomplete tasks back to backlog</li>
                </ul>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowConfirm(null)} className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={submitting}
                    className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 size={12} className="animate-spin" />}
                    Complete Sprint
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
