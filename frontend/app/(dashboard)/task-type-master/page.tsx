'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  BookOpen, Plus, Upload, ChevronDown, ChevronRight, Loader2,
  CheckCircle2, AlertCircle, X, ToggleLeft, ToggleRight, Pencil, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { taskTypeMasterApi, TaskType, TaskActivity } from '@/lib/task-type-master-api';
import { useAuthStore } from '@/lib/store/auth';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type Mode = 'new-task-type' | 'existing-task-type';
type ExistingMode = 'new-activity' | 'new-sub-activity';

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">
      {children}
    </label>
  );
}

function Input({
  value, onChange, placeholder, required,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <input
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
    />
  );
}

function Select({
  value, onChange, children, required,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; required?: boolean;
}) {
  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 cursor-pointer"
    >
      {children}
    </select>
  );
}

function Radio({
  name, value, checked, onChange, label,
}: {
  name: string; value: string; checked: boolean; onChange: () => void; label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="accent-primary"
      />
      <span className={cn('text-xs font-black uppercase tracking-widest', checked ? 'text-primary' : 'text-muted-foreground')}>
        {label}
      </span>
    </label>
  );
}

function SuccessBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
      <p className="text-xs flex-1">{message}</p>
      <button onClick={onClose}><X size={12} /></button>
    </div>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
      <AlertCircle size={14} className="shrink-0 mt-0.5" />
      <p className="text-xs flex-1">{message}</p>
      <button onClick={onClose}><X size={12} /></button>
    </div>
  );
}

// ── Tree viewer ──────────────────────────────────────────────────────────────

type EntityKind = 'taskType' | 'activity' | 'subActivity';

interface EditTarget {
  kind: EntityKind;
  id: string;
  name: string;
  description?: string | null;
}

// A clearly legible active/inactive control — a labelled, coloured pill rather
// than a bare icon, since a plain icon at small sizes was hard to read at a glance.
function StatusPill({
  isActive, onClick, showLabel = true, size = 14,
}: {
  isActive: boolean; onClick: (e: React.MouseEvent) => void; showLabel?: boolean; size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
      className={cn(
        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest transition-colors shrink-0',
        isActive
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-400'
          : 'bg-muted border-border text-muted-foreground hover:bg-muted/70',
      )}
    >
      {isActive ? <ToggleRight size={size} /> : <ToggleLeft size={size} />}
      {showLabel && (isActive ? 'Active' : 'Inactive')}
    </button>
  );
}

function EditButton({ onClick, size = 14 }: { onClick: (e: React.MouseEvent) => void; size?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Edit"
      className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
    >
      <Pencil size={size} />
    </button>
  );
}

function TreeView({ tree, onToggle, onEdit }: {
  tree: TaskType[];
  onToggle: (type: EntityKind, id: string, isActive: boolean) => void;
  onEdit: (target: EditTarget) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!tree.length) {
    return (
      <div className="py-12 flex flex-col items-center text-muted-foreground/30">
        <BookOpen size={28} strokeWidth={1} />
        <p className="text-xs font-black uppercase mt-2">No task types yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((tt) => (
        <div key={tt.id}>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer group"
            onClick={() => toggle(tt.id)}
          >
            {expanded.has(tt.id) ? (
              <ChevronDown size={12} className="text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight size={12} className="text-muted-foreground shrink-0" />
            )}
            <span className={cn('text-xs font-black flex-1', !tt.isActive && 'line-through opacity-50')}>
              {tt.name}
            </span>
            {tt.description && (
              <span className="text-xs text-muted-foreground/60 italic hidden group-hover:block">
                {tt.description}
              </span>
            )}
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <EditButton
                size={15}
                onClick={(e) => { e.stopPropagation(); onEdit({ kind: 'taskType', id: tt.id, name: tt.name, description: tt.description }); }}
              />
              <StatusPill
                size={15}
                isActive={tt.isActive}
                onClick={(e) => { e.stopPropagation(); onToggle('taskType', tt.id, tt.isActive); }}
              />
            </div>
          </div>

          {expanded.has(tt.id) && (
            <div className="ml-6 border-l pl-3 space-y-0.5">
              {tt.activities.map((act) => (
                <div key={act.id}>
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 cursor-pointer group"
                    onClick={() => toggle(act.id)}
                  >
                    {expanded.has(act.id)
                      ? <ChevronDown size={10} className="text-muted-foreground shrink-0" />
                      : <ChevronRight size={10} className="text-muted-foreground shrink-0" />}
                    <span className={cn('text-xs font-semibold flex-1', !act.isActive && 'line-through opacity-50')}>
                      {act.name}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <EditButton
                        size={13}
                        onClick={(e) => { e.stopPropagation(); onEdit({ kind: 'activity', id: act.id, name: act.name }); }}
                      />
                      <StatusPill
                        size={13}
                        showLabel={false}
                        isActive={act.isActive}
                        onClick={(e) => { e.stopPropagation(); onToggle('activity', act.id, act.isActive); }}
                      />
                    </div>
                  </div>

                  {expanded.has(act.id) && (
                    <div className="ml-5 border-l pl-3 space-y-0.5 pb-1">
                      {act.subActivities.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/20 group">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          <span className={cn('text-xs flex-1', !sub.isActive && 'line-through opacity-50')}>
                            {sub.name}
                          </span>
                          {sub.description && (
                            <span className="text-xs text-muted-foreground/50 italic hidden group-hover:block max-w-[200px] truncate">
                              {sub.description}
                            </span>
                          )}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <EditButton
                              size={13}
                              onClick={() => onEdit({ kind: 'subActivity', id: sub.id, name: sub.name, description: sub.description })}
                            />
                            <StatusPill
                              size={13}
                              showLabel={false}
                              isActive={sub.isActive}
                              onClick={() => onToggle('subActivity', sub.id, sub.isActive)}
                            />
                          </div>
                        </div>
                      ))}
                      {act.subActivities.length === 0 && (
                        <p className="text-xs text-muted-foreground/40 italic pl-3">No sub-activities</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {tt.activities.length === 0 && (
                <p className="text-xs text-muted-foreground/40 italic pl-2 py-1">No activities</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TaskTypeMasterPage() {
  const { user } = useAuthStore();
  const canEdit = ['ADMIN', 'PM'].includes(user?.role ?? '');

  const [tree, setTree] = useState<TaskType[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [mode, setMode] = useState<Mode>('new-task-type');
  const [existingMode, setExistingMode] = useState<ExistingMode>('new-activity');

  // new-task-type form
  const [ntTaskType, setNtTaskType] = useState('');
  const [ntActivity, setNtActivity] = useState('');
  const [ntSubActivity, setNtSubActivity] = useState('');
  const [ntDescription, setNtDescription] = useState('');

  // existing-task-type form
  const [selTaskTypeId, setSelTaskTypeId] = useState('');
  const [newActivityName, setNewActivityName] = useState('');
  const [alsoCreateSub, setAlsoCreateSub] = useState(false);
  const [newSubForActivity, setNewSubForActivity] = useState('');
  const [newSubDescription, setNewSubDescription] = useState('');

  const [selActivityId, setSelActivityId] = useState('');
  const [newSubActivityName, setNewSubActivityName] = useState('');
  const [newSubActivityDescription, setNewSubActivityDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Edit dialog (rename / update description for a task type, activity, or sub-activity)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // bulk upload
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<{ imported: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTree = async () => {
    setLoadingTree(true);
    try {
      const data = await taskTypeMasterApi.getTree(showInactive);
      setTree(data);
    } catch {
      setError('Failed to load task type master data.');
    } finally {
      setLoadingTree(false);
    }
  };

  useEffect(() => { loadTree(); }, [showInactive]);

  const clearFeedback = () => { setSuccess(''); setError(''); };

  // Selected task type's activities (for sub-activity form)
  const selectedTaskType = tree.find((tt) => tt.id === selTaskTypeId);
  const activitiesForSelected: TaskActivity[] = selectedTaskType?.activities ?? [];

  const handleToggle = async (
    type: 'taskType' | 'activity' | 'subActivity',
    id: string,
    isActive: boolean,
  ) => {
    try {
      if (type === 'taskType') await taskTypeMasterApi.updateTaskType(id, { isActive: !isActive });
      else if (type === 'activity') await taskTypeMasterApi.updateActivity(id, { isActive: !isActive });
      else await taskTypeMasterApi.updateSubActivity(id, { isActive: !isActive });
      await loadTree();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleOpenEdit = (target: EditTarget) => {
    setEditTarget(target);
    setEditName(target.name);
    setEditDescription(target.description ?? '');
    setEditError('');
  };

  const handleCloseEdit = () => {
    if (editSubmitting) return;
    setEditTarget(null);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) { setEditError('Name is required.'); return; }

    setEditSubmitting(true);
    setEditError('');
    try {
      if (editTarget.kind === 'taskType') {
        await taskTypeMasterApi.updateTaskType(editTarget.id, { name, description: editDescription.trim() || undefined });
      } else if (editTarget.kind === 'activity') {
        await taskTypeMasterApi.updateActivity(editTarget.id, { name });
      } else {
        await taskTypeMasterApi.updateSubActivity(editTarget.id, { name, description: editDescription.trim() || undefined });
      }
      setEditTarget(null);
      setSuccess(`"${name}" updated successfully.`);
      await loadTree();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Failed to save changes.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const editKindLabel = editTarget?.kind === 'taskType'
    ? 'Task Type'
    : editTarget?.kind === 'activity'
      ? 'Activity'
      : 'Sub-Activity';

  const resetForms = () => {
    setNtTaskType(''); setNtActivity(''); setNtSubActivity(''); setNtDescription('');
    setSelTaskTypeId(''); setNewActivityName(''); setAlsoCreateSub(false);
    setNewSubForActivity(''); setNewSubDescription('');
    setSelActivityId(''); setNewSubActivityName(''); setNewSubActivityDescription('');
    setBulkFile(null); setBulkResult(null); setUploadMode(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Submit: New Task Type ─────────────────────────────────────────────────
  const handleNewTaskType = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setSubmitting(true);
    try {
      const tt = await taskTypeMasterApi.createTaskType({ name: ntTaskType.trim(), description: ntDescription.trim() || undefined });
      const act = await taskTypeMasterApi.createActivity({ taskTypeId: tt.id, name: ntActivity.trim() });
      if (ntSubActivity.trim()) {
        await taskTypeMasterApi.createSubActivity({ activityId: act.id, name: ntSubActivity.trim() });
      }
      setSuccess(`Task type "${tt.name}" created successfully.`);
      resetForms();
      await loadTree();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create task type.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit: New Activity ──────────────────────────────────────────────────
  const handleNewActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setSubmitting(true);
    try {
      const act = await taskTypeMasterApi.createActivity({ taskTypeId: selTaskTypeId, name: newActivityName.trim() });
      if (alsoCreateSub && newSubForActivity.trim()) {
        await taskTypeMasterApi.createSubActivity({
          activityId: act.id,
          name: newSubForActivity.trim(),
          description: newSubDescription.trim() || undefined,
        });
      }
      setSuccess(`Activity "${act.name}" created successfully.`);
      resetForms();
      setSelTaskTypeId(selTaskTypeId);
      await loadTree();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create activity.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit: New Sub-Activity ──────────────────────────────────────────────
  const handleNewSubActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setSubmitting(true);
    try {
      const sub = await taskTypeMasterApi.createSubActivity({
        activityId: selActivityId,
        name: newSubActivityName.trim(),
        description: newSubActivityDescription.trim() || undefined,
      });
      setSuccess(`Sub-activity "${sub.name}" created successfully.`);
      resetForms();
      setSelTaskTypeId(selTaskTypeId);
      await loadTree();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create sub-activity.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit: Bulk Upload ───────────────────────────────────────────────────
  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) { setError('Please select a file.'); return; }
    clearFeedback();
    setSubmitting(true);
    setBulkResult(null);
    try {
      const result = await taskTypeMasterApi.bulkUpload(bulkFile);
      setBulkResult(result);
      setSuccess(`Bulk upload complete: ${result.imported} imported, ${result.skipped} skipped.`);
      await loadTree();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Bulk upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitBtn = (label: string) => (
    <button
      type="submit"
      disabled={submitting}
      className="flex items-center gap-2 px-5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
    >
      {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
      {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 px-2">
        <div>
          <h1 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
            <BookOpen className="text-primary" size={18} />
            Task Type Master
          </h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em] mt-1">
            Manage task types, activities & sub-activities
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Show inactive</span>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="transition-colors"
          >
            {showInactive
              ? <ToggleRight size={20} className="text-primary" />
              : <ToggleLeft size={20} className="text-muted-foreground" />}
          </button>
        </label>
      </div>

      {/* Feedback */}
      {success && <SuccessBanner message={success} onClose={() => setSuccess('')} />}
      {error && <ErrorBanner message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Form panel ─────────────────────────────────────────────── */}
        {canEdit && (
          <div className="border rounded-xl p-5 space-y-5 bg-card shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Add Entry</h2>

            {/* Top-level mode radio */}
            <div className="flex gap-6">
              <Radio name="mode" value="new-task-type" checked={mode === 'new-task-type'}
                onChange={() => { setMode('new-task-type'); clearFeedback(); resetForms(); }}
                label="New Task Type" />
              <Radio name="mode" value="existing-task-type" checked={mode === 'existing-task-type'}
                onChange={() => { setMode('existing-task-type'); clearFeedback(); resetForms(); }}
                label="Existing Task Type" />
            </div>

            <div className="border-t pt-4">

              {/* ── New Task Type ── */}
              {mode === 'new-task-type' && !uploadMode && (
                <form onSubmit={handleNewTaskType} className="space-y-3">
                  <div>
                    <Label>Task Type Name *</Label>
                    <Input value={ntTaskType} onChange={setNtTaskType} placeholder="e.g. Observation" required />
                  </div>
                  <div>
                    <Label>Activity Name *</Label>
                    <Input value={ntActivity} onChange={setNtActivity} placeholder="e.g. Incident Management" required />
                  </div>
                  <div>
                    <Label>Sub-Activity Name (optional)</Label>
                    <Input value={ntSubActivity} onChange={setNtSubActivity} placeholder="e.g. Ticket Triage" />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Input value={ntDescription} onChange={setNtDescription} placeholder="When to use…" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {submitBtn('Create Task Type')}
                    <button
                      type="button"
                      onClick={() => setUploadMode(true)}
                      className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Upload size={12} /> Bulk Upload
                    </button>
                  </div>
                </form>
              )}

              {/* ── Bulk Upload ── */}
              {mode === 'new-task-type' && uploadMode && (
                <form onSubmit={handleBulkUpload} className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Upload a <span className="font-bold">.xlsx</span> or <span className="font-bold">.csv</span> file with
                    columns: <span className="italic">Task Type, Activity, Sub-Activity, Simple Meaning / When to Use</span>.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                    className="text-xs w-full border rounded-lg px-3 py-2 cursor-pointer bg-background"
                  />
                  {bulkResult && (
                    <div className="text-xs space-y-1 p-3 rounded-lg bg-muted/30">
                      <p>✅ Imported: <strong>{bulkResult.imported}</strong></p>
                      <p>⏭ Skipped (already exists): <strong>{bulkResult.skipped}</strong></p>
                      {bulkResult.errors.length > 0 && (
                        <div className="mt-1">
                          <p className="text-destructive font-bold">❌ Errors ({bulkResult.errors.length}):</p>
                          {bulkResult.errors.map((e) => (
                            <p key={e.row} className="text-destructive pl-2">Row {e.row}: {e.message}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    {submitBtn('Upload')}
                    <button type="button" onClick={() => { setUploadMode(false); setBulkFile(null); setBulkResult(null); }}
                      className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* ── Existing Task Type ── */}
              {mode === 'existing-task-type' && (
                <div className="space-y-4">
                  <div>
                    <Label>Select Task Type *</Label>
                    <Select value={selTaskTypeId} onChange={(v) => { setSelTaskTypeId(v); setSelActivityId(''); }} required>
                      <option value="">-- Select task type --</option>
                      {tree.filter((tt) => tt.isActive).map((tt) => (
                        <option key={tt.id} value={tt.id}>{tt.name}</option>
                      ))}
                    </Select>
                  </div>

                  {selTaskTypeId && (
                    <>
                      <div className="flex gap-6">
                        <Radio name="existingMode" value="new-activity" checked={existingMode === 'new-activity'}
                          onChange={() => setExistingMode('new-activity')}
                          label="New Activity" />
                        <Radio name="existingMode" value="new-sub-activity" checked={existingMode === 'new-sub-activity'}
                          onChange={() => setExistingMode('new-sub-activity')}
                          label="New Sub-Activity" />
                      </div>

                      {/* New Activity under existing task type */}
                      {existingMode === 'new-activity' && (
                        <form onSubmit={handleNewActivity} className="space-y-3 border-t pt-3">
                          <div>
                            <Label>Activity Name *</Label>
                            <Input value={newActivityName} onChange={setNewActivityName}
                              placeholder="e.g. Access Management" required />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="alsoSub"
                              checked={alsoCreateSub}
                              onChange={(e) => setAlsoCreateSub(e.target.checked)}
                              className="accent-primary"
                            />
                            <label htmlFor="alsoSub" className="text-xs font-semibold cursor-pointer">
                              Also create a sub-activity for this activity
                            </label>
                          </div>
                          {alsoCreateSub && (
                            <>
                              <div>
                                <Label>Sub-Activity Name *</Label>
                                <Input value={newSubForActivity} onChange={setNewSubForActivity}
                                  placeholder="e.g. Access Grant / Change" required={alsoCreateSub} />
                              </div>
                              <div>
                                <Label>Description (optional)</Label>
                                <Input value={newSubDescription} onChange={setNewSubDescription}
                                  placeholder="When to use…" />
                              </div>
                            </>
                          )}
                          <div className="pt-1">{submitBtn('Create Activity')}</div>
                        </form>
                      )}

                      {/* New Sub-Activity under existing activity */}
                      {existingMode === 'new-sub-activity' && (
                        <form onSubmit={handleNewSubActivity} className="space-y-3 border-t pt-3">
                          <div>
                            <Label>Select Activity *</Label>
                            {activitiesForSelected.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">No activities found for this task type.</p>
                            ) : (
                              <Select value={selActivityId} onChange={setSelActivityId} required>
                                <option value="">-- Select activity --</option>
                                {activitiesForSelected.map((a) => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </Select>
                            )}
                          </div>
                          {selActivityId && (
                            <>
                              <div>
                                <Label>Sub-Activity Name *</Label>
                                <Input value={newSubActivityName} onChange={setNewSubActivityName}
                                  placeholder="e.g. Log Analysis" required />
                              </div>
                              <div>
                                <Label>Description (optional)</Label>
                                <Input value={newSubActivityDescription}
                                  onChange={setNewSubActivityDescription}
                                  placeholder="When to use…" />
                              </div>
                              <div className="pt-1">{submitBtn('Create Sub-Activity')}</div>
                            </>
                          )}
                        </form>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Right: Tree viewer ───────────────────────────────────────────── */}
        <div className={cn('border rounded-xl p-5 bg-card shadow-sm', !canEdit && 'lg:col-span-2')}>
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">
            Current Master Data
          </h2>
          {loadingTree ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary opacity-50" />
            </div>
          ) : (
            <TreeView
              tree={tree}
              onToggle={canEdit ? handleToggle : () => {}}
              onEdit={canEdit ? handleOpenEdit : () => {}}
            />
          )}
        </div>
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) handleCloseEdit(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editKindLabel}</DialogTitle>
            <DialogDescription>
              Update the name{editTarget?.kind !== 'activity' ? ' and description' : ''} for this {editKindLabel.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={editName} onChange={setEditName} placeholder="Name" required />
            </div>
            {editTarget?.kind !== 'activity' && (
              <div>
                <Label>Description (optional)</Label>
                <Input value={editDescription} onChange={setEditDescription} placeholder="When to use…" />
              </div>
            )}
            {editError && (
              <p className="text-xs text-destructive font-medium">{editError}</p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={handleCloseEdit}
              disabled={editSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={editSubmitting}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {editSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {editSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
