'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Search,
  Loader2,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  FilePlus,
  TrendingUp,
  Building2,
  ArrowUpRight,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  name: string;
  amount: number;
  status: string;
  completion: number;
  project: { id: string; name: string };
  clientPo?: { id: string; poNumber: string };
  invoices: { id: string; total: number; status: string }[];
}

// ─── Generate Invoice Modal ───────────────────────────────────────────────────

function GenerateInvoiceModal({
  milestone,
  onClose,
  onCreated,
}: {
  milestone: Milestone;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [amount, setAmount] = useState(milestone.amount.toString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const invoicedTotal = milestone.invoices.reduce((s, i) => s + i.total, 0);
  const remaining = milestone.amount - invoicedTotal;

  async function submit() {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setError('Invalid amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/finance/invoice/${milestone.id}`, { amount: val });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-xl p-5 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-black text-sm uppercase tracking-tight">Generate Invoice</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-bold uppercase tracking-widest">{milestone.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors"><X size={16} /></button>
        </div>

        <div className="bg-muted/5 border rounded-lg p-3 mb-6 space-y-2">
          <div className="flex justify-between text-xs font-black uppercase tracking-widest opacity-60">
            <span>Milestone Total</span>
            <span>₹{milestone.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs font-black uppercase tracking-widest opacity-60">
            <span>Already Invoiced</span>
            <span>₹{invoicedTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs font-black uppercase tracking-widest border-t pt-2 border-border/40">
            <span>Remaining Balance</span>
            <span className="text-primary">₹{remaining.toLocaleString()}</span>
          </div>
        </div>

        {error && <p className="mb-4 text-xs font-bold text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">{error}</p>}
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Invoice Amount (₹) *</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={remaining}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg border hover:bg-secondary transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={saving || parseFloat(amount) > remaining}
            className="px-5 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-primary/20"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <FilePlus size={12} />} Generate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Milestone[]>('/finance/milestones');
      setMilestones(data);
    } catch (err) {
      console.error('Failed to load milestones', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = milestones.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.project.name.toLowerCase().includes(search.toLowerCase()) ||
    m.clientPo?.poNumber.toLowerCase().includes(search.toLowerCase() || '')
  );

  const totalValue = milestones.reduce((s, m) => s + m.amount, 0);
  const achievedValue = milestones.filter(m => m.status === 'ACHIEVED' || m.status === 'FULLY_INVOICED').reduce((s, m) => s + m.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 uppercase">
            <Layers className="text-primary" size={20} />
            Billing Milestones
          </h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">
            Track project deliverables and trigger invoicing.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
        {[
          { label: 'Total Contract Value', value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: TrendingUp, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-500/10' },
          { label: 'Achieved / Invoiced', value: `₹${(achievedValue / 100000).toFixed(1)}L`, icon: CheckCircle2, color: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-500/10' },
        ].map((stat, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all group">
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
          placeholder="Filter milestones..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-1.5 rounded-lg border bg-background/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
        />
      </div>

      {/* Milestones List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2 pb-10">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto opacity-50" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center opacity-60">
             <Layers className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
             <p className="text-xs font-black uppercase tracking-widest">No milestones found</p>
          </div>
        ) : (
          filtered.map(m => {
            const invoiced = m.invoices.reduce((s, i) => s + i.total, 0);
            const isReady = m.status === 'ACHIEVED' || m.completion >= 100;
            const isFullyInvoiced = invoiced >= m.amount;

            return (
              <div key={m.id} className="bg-card border rounded-xl p-4 shadow-sm hover:border-primary/30 transition-all flex flex-col group">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-tight text-foreground line-clamp-1">{m.name}</h3>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5 opacity-70">
                      <Building2 size={10} className="inline mr-1" /> {m.project.name}
                    </p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 text-xs font-black uppercase tracking-widest rounded-full border",
                    m.status === 'ACHIEVED' ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
                    m.status === 'PENDING' ? "bg-amber-500/10 text-amber-600 border-amber-200" :
                    "bg-blue-500/10 text-blue-600 border-blue-200"
                  )}>
                    {m.status}
                  </span>
                </div>

                <div className="mt-auto space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-60">
                      <span>Completion</span>
                      <span>{m.completion}%</span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${m.completion}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-end border-t pt-3 border-border/40">
                    <div>
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest opacity-60">Value</p>
                      <p className="text-xs font-black text-foreground tracking-tighter">₹{m.amount.toLocaleString()}</p>
                    </div>
                    {isReady && !isFullyInvoiced && (
                      <button 
                        onClick={() => setSelectedMilestone(m)}
                        className="p-2 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary transition-all flex items-center gap-1.5"
                        title="Generate Invoice"
                      >
                        <FilePlus size={14} />
                        <span className="text-xs font-black uppercase tracking-widest">Invoice</span>
                      </button>
                    )}
                    {isFullyInvoiced && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <Check size={12} strokeWidth={3} />
                        <span className="text-xs font-black uppercase tracking-widest">Invoiced</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedMilestone && (
        <GenerateInvoiceModal
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
          onCreated={() => { setSelectedMilestone(null); load(); }}
        />
      )}
    </div>
  );
}
