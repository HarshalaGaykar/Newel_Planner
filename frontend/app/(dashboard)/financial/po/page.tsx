'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  Loader2,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  IndianRupee,
  Layers,
  TrendingUp,
  Clock,
  Building2,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project { id: string; name: string; type: string }
interface Milestone {
  id: string;
  name: string;
  amount: number;
  status: string;
  completion: number;
  dueDate: string | null;
}
interface ClientPO {
  id: string;
  poNumber: string;
  amount: number;
  status: string;
  placeOfSupply: string | null;
  createdAt: string;
  project: Project;
  milestones: Milestone[];
  invoices: { id: string; total: number; status: string }[];
}

// ─── Create PO Modal ──────────────────────────────────────────────────────────

function CreatePOModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ projectId: '', poNumber: '', amount: '', placeOfSupply: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!form.projectId || !form.poNumber || !form.amount) {
      setError('Project, PO Number and Amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/finance/client-po', {
        projectId: form.projectId,
        poNumber: form.poNumber,
        amount: parseFloat(form.amount),
        placeOfSupply: form.placeOfSupply || undefined,
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create PO.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-xl p-5 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-black text-sm uppercase tracking-tight">Create Client PO</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-bold uppercase tracking-widest">New Purchase Order</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors"><X size={16} /></button>
        </div>
        {error && <p className="mb-4 text-xs font-bold text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">{error}</p>}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Project *</label>
            <select
              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
              value={form.projectId}
              onChange={(e) => setForm(f => ({ ...f, projectId: e.target.value }))}
            >
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">PO Number *</label>
              <input
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                placeholder="PO-2026-001"
                value={form.poNumber}
                onChange={(e) => setForm(f => ({ ...f, poNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Amount (₹) *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                placeholder="500000"
                value={form.amount}
                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Place of Supply</label>
            <input
              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
              placeholder="e.g. Maharashtra"
              value={form.placeOfSupply}
              onChange={(e) => setForm(f => ({ ...f, placeOfSupply: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg border hover:bg-secondary transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-primary/20"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Create PO
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PO Row ───────────────────────────────────────────────────────────────────

function PORow({ po, onDelete }: { po: ClientPO; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const invoicedTotal = (po.invoices ?? []).reduce((s, i) => s + i.total, 0);
  const paidTotal = (po.invoices ?? []).filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const utilizationPct = po.amount > 0 ? Math.min((invoicedTotal / po.amount) * 100, 100) : 0;

  const statusColor = po.status === 'ACTIVE'
    ? 'bg-emerald-500/5 text-emerald-600 border-emerald-200/50'
    : po.status === 'CLOSED'
    ? 'bg-slate-500/5 text-muted-foreground border-slate-200/50'
    : 'bg-amber-500/5 text-amber-600 border-amber-200/50';

  return (
    <div className="border rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-200 bg-card">
      {/* PO Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer group"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
          <FileText size={16} className="text-primary opacity-70" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <p className="font-bold text-xs uppercase tracking-tight">{po.poNumber}</p>
            <span className={cn('px-2 py-0.5 text-xs font-black uppercase tracking-widest rounded-full border', statusColor)}>
              {po.status}
            </span>
          </div>
          <p className="text-xs font-bold text-muted-foreground mt-0.5 truncate uppercase tracking-tighter opacity-80">
            <Building2 size={10} className="inline mr-1 opacity-60" />{po.project?.name ?? 'Unknown Project'}
            {po.placeOfSupply && <span className="ml-2 text-muted-foreground/50 italic">· {po.placeOfSupply}</span>}
          </p>
        </div>

        {/* Progress bar */}
        <div className="hidden md:block w-32">
          <div className="flex justify-between text-xs font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-70">
            <span>Invoiced</span><span>{utilizationPct.toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${utilizationPct}%` }}
            />
          </div>
        </div>

        <div className="text-right shrink-0 min-w-[120px]">
          <p className="font-black text-xs text-foreground tracking-tighter">₹{po.amount.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground font-black uppercase tracking-tighter mt-0.5 opacity-60">
            Paid: ₹{paidTotal.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this PO?')) onDelete(po.id); }}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronDown size={14} className="text-muted-foreground opacity-50" /> : <ChevronRight size={14} className="text-muted-foreground opacity-50" />}
        </div>
      </div>

      {/* Milestones */}
      {expanded && (
        <div className="border-t bg-muted/5 px-5 py-4 space-y-2 animate-in fade-in duration-200">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 flex items-center gap-2 opacity-70">
            <Layers size={11} /> Linked Milestones
          </p>
          {po.milestones.length === 0 ? (
            <p className="text-xs font-bold text-muted-foreground/60 text-center py-6 uppercase tracking-widest">No milestones linked</p>
          ) : (
            <div className="space-y-1.5">
              {po.milestones.map(m => (
                <div key={m.id} className="flex items-center gap-4 p-2.5 bg-card rounded-lg border border-border/50 hover:border-primary/20 transition-colors group/m">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate uppercase tracking-tight">{m.name}</p>
                    {m.dueDate && (
                      <p className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <Clock size={8} /> Due {new Date(m.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="w-24 hidden sm:block">
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', m.completion >= 100 ? 'bg-emerald-500' : 'bg-primary/60')}
                        style={{ width: `${m.completion}%` }}
                      />
                    </div>
                  </div>
                  <p className="font-black text-xs text-right shrink-0 min-w-[80px]">₹{m.amount.toLocaleString('en-IN')}</p>
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-black uppercase tracking-widest rounded-full border border-transparent shrink-0',
                    m.status === 'ACHIEVED' ? 'bg-emerald-500/5 text-emerald-600' :
                    m.status === 'IN_PROGRESS' ? 'bg-blue-500/5 text-blue-600' :
                    'bg-slate-500/5 text-muted-foreground'
                  )}>
                    {m.status}
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

export default function ClientPOPage() {
  const [clientPOs, setClientPOs] = useState<ClientPO[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes, projRes] = await Promise.all([
        api.get<ClientPO[]>('/finance/client-pos'),
        api.get<Project[]>('/projects'),
      ]);
      setClientPOs(posRes.data);
      setProjects(projRes.data);
    } catch (err) {
      console.error('Failed to load client POs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    await api.delete(`/finance/client-po/${id}`);
    await load();
  };

  const filtered = clientPOs.filter(po =>
    po.poNumber.toLowerCase().includes(search.toLowerCase()) ||
    po.project?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const totalValue = clientPOs.reduce((s, po) => s + po.amount, 0);
  const totalInvoiced = clientPOs.reduce((s, po) => s + (po.invoices ?? []).reduce((si, i) => si + i.total, 0), 0);
  const totalPaid = clientPOs.reduce((s, po) => s + (po.invoices ?? []).filter(i => i.status === 'PAID').reduce((si, i) => si + i.total, 0), 0);
  const activePOs = clientPOs.filter(po => po.status === 'ACTIVE').length;

  if (loading) {
    return <div className="h-full flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 uppercase">
            <FileText className="text-primary" size={20} />
            Client PO Management
          </h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">
            Track purchase orders, milestones, and invoicing across projects.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all hover:scale-105 flex items-center gap-2"
        >
          <Plus size={14} /> New PO
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total PO Value', value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: IndianRupee, color: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-500/10' },
          { label: 'Active POs', value: activePOs.toString(), icon: FileText, color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-500/10' },
          { label: 'Total Invoiced', value: `₹${(totalInvoiced / 100000).toFixed(1)}L`, icon: TrendingUp, color: 'from-purple-500 to-violet-500', bg: 'bg-purple-500/10' },
          { label: 'Amount Received', value: `₹${(totalPaid / 100000).toFixed(1)}L`, icon: CheckCircle2, color: 'from-amber-400 to-orange-500', bg: 'bg-amber-500/10' },
        ].map((stat, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className={cn('absolute top-0 right-0 w-20 h-20 -mr-4 -mt-4 rounded-full opacity-10 blur-xl transition-all group-hover:opacity-20', `bg-gradient-to-br ${stat.color}`)} />
            <div className="flex items-center justify-between mb-2 relative z-10">
              <div className={cn('p-1.5 rounded-lg border border-border/50', stat.bg)}>
                <stat.icon size={14} className="text-primary" />
              </div>
              <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] text-right opacity-70">{stat.label}</span>
            </div>
            <h3 className="text-xl font-black text-foreground tracking-tighter relative z-10">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm group px-2">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={14} />
        <input
          type="text"
          placeholder="Filter POs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-1.5 rounded-lg border bg-background/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
        />
      </div>

      {/* PO List */}
      <div className="space-y-3 px-2 pb-10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 border border-dashed rounded-xl text-muted-foreground bg-muted/5 opacity-60">
            <FileText size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-xs font-black uppercase tracking-widest">No purchase orders found</p>
          </div>
        ) : (
          filtered.map(po => <PORow key={po.id} po={po} onDelete={handleDelete} />)
        )}
      </div>

      {showModal && (
        <CreatePOModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
