'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, X, ChevronDown, ChevronUp,
  Download, MessageSquarePlus, Save, Clock, History, Mail, Send,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { projectsApi, Project } from '@/lib/projects-api';
import {
  deliveryTrackerApi,
  DeliveryItem,
  DeliveryItemHistory,
  DeliveryStatus,
  CreateDeliveryItemPayload,
} from '@/lib/delivery-tracker-api';
import { stageMasterApi, DeliveryStage } from '@/lib/stage-master-api';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import RecipientsModal from '@/components/delivery-tracker/RecipientsModal';
import SendReportDialog from '@/components/delivery-tracker/SendReportDialog';
import ReportDetailsCard from '@/components/delivery-tracker/ReportDetailsCard';
import ReportHistoryPanel from '@/components/delivery-tracker/ReportHistoryPanel';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: DeliveryStatus[] = ['OPEN', 'IN_PROGRESS', 'CLOSED'];

const RAG_CELL: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
  none:  'bg-muted',
};
const RAG_TEXT: Record<string, string> = {
  green: 'text-white',
  amber: 'text-white',
  red:   'text-white',
  none:  'text-muted-foreground',
};

function computeRAG(item: DeliveryItem): 'green' | 'amber' | 'red' | 'none' {
  if (item.status === 'CLOSED') return 'green';
  const due = item.plannedEnd;
  if (!due) return 'none';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - dueDay.getTime()) / 86_400_000;
  if (diff < 1) return 'green';
  if (diff < 2) return 'amber';
  return 'red';
}

// Returns old date strings (formatted) from history for a given field label
function oldDates(item: DeliveryItem, fieldLabel: string): string[] {
  return item.history
    .filter(h => h.field === fieldLabel && h.oldValue)
    .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
    .map(h => new Date(h.oldValue!).toLocaleDateString('en-GB'));
}

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB') : '—';
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Date cell with strike-through on old values
function DateCell({ current, old }: { current: string | null | undefined; old: string[] }) {
  if (!old.length && !current) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="text-xs space-y-0.5 text-center">
      {old.map((d, i) => (
        <p key={i} className="line-through text-muted-foreground/60">{d}</p>
      ))}
      {current && <p className="text-foreground font-medium">{fmtDate(current)}</p>}
    </div>
  );
}

// ─── Item Form Modal ──────────────────────────────────────────────────────────

interface ItemForm {
  srNo: string; title: string;
  plannedStart: string; plannedEnd: string;
  actualStart: string; actualEnd: string;
  stageId: string;
  status: DeliveryStatus; remarks: string;
}

const emptyForm = (n: number): ItemForm => ({
  srNo: String(n), title: '', plannedStart: '', plannedEnd: '',
  actualStart: '', actualEnd: '',
  stageId: '', status: 'OPEN', remarks: '',
});

function ItemModal({ initial, nextSrNo, stages, onSave, onClose }: {
  initial?: DeliveryItem; nextSrNo: number; stages: DeliveryStage[];
  onSave: (p: Partial<CreateDeliveryItemPayload>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemForm>(
    initial ? {
      srNo: String(initial.srNo), title: initial.title,
      plannedStart: initial.plannedStart?.slice(0, 10) ?? '',
      plannedEnd: initial.plannedEnd?.slice(0, 10) ?? '',
      actualStart: initial.actualStart?.slice(0, 10) ?? '',
      actualEnd: initial.actualEnd?.slice(0, 10) ?? '',
      stageId: initial.stageId ?? '',
      status: initial.status, remarks: '',
    } : emptyForm(nextSrNo),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof ItemForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.title.trim())  { setError('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        srNo: Number(form.srNo), title: form.title.trim(),
        plannedStart: form.plannedStart || undefined,
        plannedEnd:   form.plannedEnd   || undefined,
        actualStart:  form.actualStart  || undefined,
        actualEnd:    form.actualEnd    || undefined,
        // '' clears the stage server-side; undefined would leave it untouched.
        stageId:      form.stageId,
        status:       form.status,
        ...(!initial && form.remarks.trim() && { remarks: form.remarks.trim() }),
      });
      onClose();
    } catch { setError('Failed to save. Please try again.'); }
    finally  { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">
            {initial ? 'Edit Delivery Item' : 'New Delivery Item'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Sr No</label>
              <input className="field-input" type="number" min={1} value={form.srNo} onChange={set('srNo')} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="field-input" value={form.status} onChange={set('status')}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Item / Title <span className="text-red-500">*</span></label>
            <input className="field-input" value={form.title} onChange={set('title')} placeholder="e.g. Masters observation resolution" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Planned Start Date</label>
              <input className="field-input" type="date" value={form.plannedStart} onChange={set('plannedStart')} />
            </div>
            <div>
              <label className="form-label">Planned End Date</label>
              <input className="field-input" type="date" value={form.plannedEnd} onChange={set('plannedEnd')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Actual Start Date</label>
              <input className="field-input" type="date" value={form.actualStart} onChange={set('actualStart')} />
            </div>
            <div>
              <label className="form-label">Actual End Date</label>
              <input className="field-input" type="date" value={form.actualEnd} onChange={set('actualEnd')} />
            </div>
          </div>
          <div>
            <label className="form-label">Current Stage</label>
            <select className="field-input" value={form.stageId} onChange={set('stageId')}>
              <option value="">— None —</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              {/* A stage since deactivated stays selectable on the item already
                  using it, so editing another field cannot silently clear it. */}
              {initial?.stage && !stages.some(s => s.id === initial.stage!.id) && (
                <option value={initial.stage.id}>{initial.stage.name} (inactive)</option>
              )}
            </select>
          </div>
          {!initial && (
            <div>
              <label className="form-label">Remarks</label>
              <textarea
                className="field-input resize-none"
                rows={2}
                value={form.remarks}
                onChange={set('remarks')}
                placeholder="Optional first remark for this item…"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm flex items-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Expanded Detail Panel ────────────────────────────────────────────────────

function DetailPanel({ item, onRemarkAdded }: { item: DeliveryItem; onRemarkAdded: () => void }) {
  const [tab, setTab]         = useState<'remarks' | 'history'>('remarks');
  const [history, setHistory] = useState<DeliveryItemHistory[]>([]);
  const [loadingH, setLoadingH] = useState(false);

  const [date, setDate]       = useState(today());
  const [content, setContent] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const loadHistory = useCallback(async () => {
    if (tab !== 'history') return;
    setLoadingH(true);
    try { setHistory(await deliveryTrackerApi.getHistory(item.id)); }
    finally { setLoadingH(false); }
  }, [item.id, tab]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submitRemark = async () => {
    if (!content.trim()) { setError('Content is required'); return; }
    setSaving(true); setError('');
    try {
      await deliveryTrackerApi.addRemark(item.id, { date, content: content.trim() });
      setContent('');
      onRemarkAdded();
    } catch { setError('Failed to add remark'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-muted/30 border-t border-border">
      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        <button
          onClick={() => setTab('remarks')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
            tab === 'remarks'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <MessageSquarePlus size={12} />
          Remarks
          {item.remarks.length > 0 && (
            <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-mono text-[10px]">
              {item.remarks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
            tab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <History size={12} />
          Change History
        </button>
      </div>

      {/* Remarks tab */}
      {tab === 'remarks' && (
        <div className="p-4 space-y-3">
          {item.remarks.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {item.remarks.map(r => (
                <div key={r.id} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 font-medium w-20">{fmtDate(r.date)}</span>
                  <span className="text-foreground">{r.content}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No remarks yet.</p>
          )}

          {/* Add remark */}
          <div className="flex gap-2 items-start pt-1 border-t border-border">
            <input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              className="field-input w-36 text-xs"
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Add remark…"
              rows={2}
              className="field-input flex-1 text-xs resize-none"
            />
            <button
              onClick={submitRemark} disabled={saving}
              className="btn btn-primary text-xs flex items-center gap-1 h-8 px-3"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <MessageSquarePlus size={12} />}
              Add
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="p-4">
          {loadingH ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> Loading history…
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No changes recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {history.map(h => (
                <div key={h.id} className="flex gap-3 text-xs">
                  <span className="text-muted-foreground shrink-0 w-32 flex items-center gap-1">
                    <Clock size={10} />
                    {fmtDateTime(h.changedAt)}
                  </span>
                  <span className="font-medium text-foreground shrink-0 w-24">{h.field}</span>
                  <span className="text-muted-foreground">
                    {h.oldValue
                      ? <><span className="line-through">{h.oldValue}</span> → <span className="text-foreground">{h.newValue ?? '—'}</span></>
                      : <span className="text-foreground">{h.newValue ?? '—'}</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeliveryTrackerPage() {
  const { hasPermission } = useAuthStore();
  const canView   = hasPermission('TRACKER_VIEW');
  const canExport = hasPermission('TRACKER_EXPORT');

  const [mounted, setMounted]       = useState(false);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [projectId, setProjectId]   = useState('');
  const [items, setItems]           = useState<DeliveryItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalItem, setModalItem]   = useState<DeliveryItem | 'new' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting]   = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [sendReportOpen, setSendReportOpen] = useState(false);
  const [tab, setTab] = useState<'tracker' | 'history'>('tracker');
  const [stages, setStages] = useState<DeliveryStage[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => { projectsApi.getAll().then(setProjects).catch(() => {}); }, []);

  // Only active stages are offered for selection.
  useEffect(() => { stageMasterApi.getStages(true).then(setStages).catch(() => {}); }, []);

  const loadItems = useCallback(async () => {
    if (!projectId) { setItems([]); return; }
    setLoading(true);
    try { setItems(await deliveryTrackerApi.getAll(projectId)); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleSave = async (payload: Partial<CreateDeliveryItemPayload>) => {
    if (modalItem === 'new') {
      await deliveryTrackerApi.create(projectId, payload as CreateDeliveryItemPayload);
    } else if (modalItem) {
      await deliveryTrackerApi.update(modalItem.id, payload);
    }
    await loadItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this delivery item?')) return;
    setDeletingId(id);
    try { await deliveryTrackerApi.remove(id); await loadItems(); }
    finally { setDeletingId(null); }
  };

  const handleExport = async () => {
    if (!projectId) return;
    setExporting(true);
    try {
      const res = await api.get('/delivery-tracker/export', { params: { projectId }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a   = Object.assign(document.createElement('a'), { href: url, download: `tracker-${projectId}.xlsx` });
      a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const nextSrNo = items.length > 0 ? Math.max(...items.map(i => i.srNo)) + 1 : 1;

  if (!mounted) return null;

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        You do not have permission to view the Delivery Tracker.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Delivery Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">High-level project delivery status for stakeholders</p>
        </div>
        <div className="flex items-center gap-2">
          {projectId && (
            <button onClick={() => setRecipientsOpen(true)}
              className="btn btn-ghost text-sm flex items-center gap-1.5 border border-border">
              <Mail size={14} /> Recipients
            </button>
          )}
          {canExport && projectId && (
            <button onClick={handleExport} disabled={exporting}
              className="btn btn-ghost text-sm flex items-center gap-1.5 border border-border">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export
            </button>
          )}
          {canExport && projectId && (
            <button onClick={() => setSendReportOpen(true)}
              className="btn btn-primary text-sm flex items-center gap-1.5">
              <Send size={14} /> Send Report
            </button>
          )}
          {projectId && (
            <button onClick={() => setModalItem('new')}
              className="btn btn-primary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Project selector */}
      <div className="flex items-center gap-3">
        <label className="form-label shrink-0 mb-0">Project</label>
        <select className="field-input max-w-xs" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">— Select a project —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Report header — feeds the Excel export, the preview and the emailed report.
          Keys are prefixed because these conditional siblings share one children
          array: two elements keyed on the bare projectId collide. */}
      {projectId && <ReportDetailsCard key={`details-${projectId}`} projectId={projectId} />}

      {projectId && (
        <div className="flex gap-1 border-b border-border">
          {([['tracker', 'Delivery Items'], ['history', 'Report History']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {projectId && tab === "history" && <ReportHistoryPanel key={`history-${projectId}`} projectId={projectId} />}

      {/* Table */}
      {tab === 'tracker' && (loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : !projectId ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Select a project to view its delivery tracker.
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
          <p>No delivery items yet.</p>
          <button onClick={() => setModalItem('new')}
            className="btn btn-primary text-sm flex items-center gap-1.5">
            <Plus size={14} /> Add First Item
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1220px]">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-3 py-2.5 text-center w-10">Sr</th>
                  <th className="px-3 py-2.5 text-left">Item</th>
                  <th className="px-3 py-2.5 text-center w-22">Planned Start</th>
                  <th className="px-3 py-2.5 text-center w-22">Planned End</th>
                  <th className="px-3 py-2.5 text-center w-22">Actual Start</th>
                  <th className="px-3 py-2.5 text-center w-22">Actual End</th>
                  <th className="px-3 py-2.5 text-left w-32">Stage</th>
                  <th className="px-3 py-2.5 text-center w-24">Status</th>
                  <th className="px-3 py-2.5 text-left">Remarks</th>
                  <th className="px-3 py-2.5 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => {
                  const expanded = expandedId === item.id;
                  const isAlt    = idx % 2 === 1;
                  const rag      = computeRAG(item);
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={cn('hover:bg-muted/30 transition-colors align-top', isAlt && 'bg-muted/20')}
                      >
                        <td className="px-3 py-2.5 text-center text-muted-foreground font-mono text-xs">
                          {item.srNo}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-foreground">{item.title}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{fmtDate(item.plannedStart)}</td>

                        {/* Planned End Date — with strike-through on old values */}
                        <td className="px-3 py-2.5">
                          <DateCell current={item.plannedEnd} old={oldDates(item, 'Planned End Date')} />
                        </td>

                        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{fmtDate(item.actualStart)}</td>
                        {/* Actual End Date — with strike-through on old values */}
                        <td className="px-3 py-2.5">
                          <DateCell current={item.actualEnd} old={oldDates(item, 'Actual End Date')} />
                        </td>

                        <td className="px-3 py-2.5 text-xs text-foreground">{item.stage?.name ?? '—'}</td>

                        {/* Status — RAG coloured cell with status text */}
                        <td className="px-3 py-2.5 text-center">
                          <span className={cn(
                            'inline-block w-full rounded px-2 py-1 text-xs font-semibold',
                            RAG_CELL[rag], RAG_TEXT[rag],
                          )}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Remarks — show inline, expand for add */}
                        <td className="px-3 py-2.5 max-w-xs">
                          {item.remarks.length > 0 ? (
                            <div className="space-y-0.5">
                              {item.remarks.map(r => (
                                <p key={r.id} className="text-xs text-muted-foreground leading-snug">
                                  <span className="font-medium text-foreground">{fmtDate(r.date)}:</span>{' '}
                                  {r.content}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setExpandedId(expanded ? null : item.id)}
                              title="Remarks & History"
                              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            <button
                              onClick={() => setModalItem(item)}
                              title="Edit"
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                              title="Delete"
                              className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              {deletingId === item.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded: Remarks + History */}
                      {expanded && (
                        <tr className={cn(isAlt && 'bg-muted/10')}>
                          <td colSpan={10} className="p-0">
                            <DetailPanel item={item} onRemarkAdded={loadItems} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Legend */}
      {tab === 'tracker' && items.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          {([
            { key: 'green', label: 'On time (< 1 day)' },
            { key: 'amber', label: '1–2 days overdue' },
            { key: 'red',   label: '> 2 days overdue' },
          ] as const).map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={cn('w-3 h-3 rounded inline-block', RAG_CELL[key])} />
              {label}
            </span>
          ))}
          <span className="text-muted-foreground/60 ml-2 italic">Status cell colour = RAG based on planned end date</span>
        </div>
      )}

      {modalItem && (
        <ItemModal
          initial={modalItem === 'new' ? undefined : modalItem}
          nextSrNo={nextSrNo}
          stages={stages}
          onSave={handleSave}
          onClose={() => setModalItem(null)}
        />
      )}

      {recipientsOpen && projectId && (
        <RecipientsModal projectId={projectId} onClose={() => setRecipientsOpen(false)} />
      )}

      {projectId && (
        <SendReportDialog
          projectId={projectId}
          projectName={projects.find((p) => p.id === projectId)?.name ?? ''}
          open={sendReportOpen}
          onClose={() => setSendReportOpen(false)}
          onOpenRecipients={() => { setSendReportOpen(false); setRecipientsOpen(true); }}
        />
      )}
    </div>
  );
}
