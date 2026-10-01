'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, Loader2, X, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { stageMasterApi, DeliveryStage } from '@/lib/stage-master-api';
import { cn } from '@/lib/utils';

function errorMessage(err: unknown, fallback: string) {
  const res = (err as { response?: { data?: { message?: string | string[] } } })?.response;
  const msg = res?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg || fallback;
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function StageModal({ initial, nextSortOrder, onSave, onClose }: {
  initial?: DeliveryStage;
  nextSortOrder: number;
  onSave: (data: { name: string; sortOrder: number; isActive: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]           = useState(initial?.name ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? nextSortOrder));
  const [isActive, setIsActive]   = useState(initial?.isActive ?? true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Stage name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), sortOrder: Number(sortOrder) || 0, isActive });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">
            {initial ? 'Edit Stage' : 'New Stage'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <p className="flex items-start gap-2 text-xs font-medium text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
              <AlertCircle size={14} className="mt-px shrink-0" /> {error}
            </p>
          )}

          <div>
            <label className="form-label">Stage Name</label>
            <input
              className="field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. UAT Sign-off"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Sort Order</label>
              <input
                className="field-input"
                type="number"
                min={0}
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="field-input"
                value={isActive ? 'active' : 'inactive'}
                onChange={e => setIsActive(e.target.value === 'active')}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Inactive stages stay visible on delivery items already using them, but
            are not offered when picking a stage.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="btn btn-secondary text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial ? 'Save Changes' : 'Create Stage'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StageMasterPage() {
  const { hasPermission, user } = useAuthStore();
  const canView = hasPermission('TRACKER_VIEW');
  // Mutations are ADMIN-only server-side; mirror that here so the UI does not
  // offer buttons that are guaranteed to 403.
  const canManage = user?.role === 'ADMIN';

  const [stages, setStages]   = useState<DeliveryStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<DeliveryStage | 'new' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStages(await stageMasterApi.getStages());
    } catch (err) {
      setError(errorMessage(err, 'Failed to load stages'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: { name: string; sortOrder: number; isActive: boolean }) => {
    if (modal === 'new') await stageMasterApi.createStage(data);
    else if (modal)      await stageMasterApi.updateStage(modal.id, data);
    await load();
  };

  const handleDelete = async (stage: DeliveryStage) => {
    if (!window.confirm(`Delete the stage "${stage.name}"?`)) return;
    setDeletingId(stage.id);
    setError('');
    try {
      await stageMasterApi.deleteStage(stage.id);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete stage'));
    } finally {
      setDeletingId(null);
    }
  };

  const nextSortOrder = stages.length
    ? Math.max(...stages.map(s => s.sortOrder)) + 1
    : 1;

  if (!canView) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have permission to view the stage master.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Layers size={20} className="text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Stage Master</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Delivery lifecycle stages offered in the Delivery Tracker.
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setModal('new')}
            className="btn btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus size={14} /> New Stage
          </button>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 text-xs font-medium text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
          <AlertCircle size={14} className="mt-px shrink-0" /> {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading stages…
        </div>
      ) : stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
          <p>No stages defined yet.</p>
          {canManage && (
            <button onClick={() => setModal('new')} className="btn btn-primary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Add First Stage
            </button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="px-3 py-2.5 text-center w-20">Order</th>
                <th className="px-3 py-2.5 text-left">Stage Name</th>
                <th className="px-3 py-2.5 text-center w-28">Status</th>
                {canManage && <th className="px-3 py-2.5 text-center w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stages.map((stage, idx) => (
                <tr key={stage.id} className={cn('hover:bg-muted/30 transition-colors', idx % 2 === 1 && 'bg-muted/20')}>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground font-mono">
                    {stage.sortOrder}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{stage.name}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn(
                      'inline-block rounded px-2 py-0.5 text-xs font-semibold',
                      stage.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      {stage.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setModal(stage)}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${stage.name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(stage)}
                          disabled={deletingId === stage.id}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50"
                          aria-label={`Delete ${stage.name}`}
                        >
                          {deletingId === stage.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <StageModal
          initial={modal === 'new' ? undefined : modal}
          nextSortOrder={nextSortOrder}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
