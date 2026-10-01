'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  Plus,
  Search,
  Loader2,
  Filter,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ChevronRight,
  MoreHorizontal,
  Building2,
  TrendingUp,
  X,
  Check,
  FileText,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  status: string;
  invoice: { id: string; invoiceNo: string };
}

interface Invoice {
  id: string;
  invoiceNo: string;
  total: number;
  status: string;
  clientPo: { poNumber: string };
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({
  invoices,
  onClose,
  onCreated,
}: {
  invoices: Invoice[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ invoiceId: '', amount: '', method: 'WIRE_TRANSFER' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedInvoice = invoices.find(i => i.id === form.invoiceId);

  async function submit() {
    if (!form.invoiceId || !form.amount) {
      setError('Invoice and Amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/finance/payment', {
        invoiceId: form.invoiceId,
        amount: parseFloat(form.amount),
        method: form.method,
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-xl p-5 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-black text-sm uppercase tracking-tight">Record Payment</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-bold uppercase tracking-widest">Mark an invoice as paid</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors"><X size={16} /></button>
        </div>

        {error && <p className="mb-4 text-xs font-bold text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">{error}</p>}
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Invoice *</label>
            <select
              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
              value={form.invoiceId}
              onChange={(e) => {
                const inv = invoices.find(i => i.id === e.target.value);
                setForm(f => ({ ...f, invoiceId: e.target.value, amount: inv ? inv.total.toString() : '' }));
              }}
            >
              <option value="">Select invoice...</option>
              {invoices.filter(i => i.status !== 'PAID').map(i => (
                <option key={i.id} value={i.id}>{i.invoiceNo} (₹{i.total.toLocaleString()})</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Amount (₹) *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                value={form.amount}
                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Method *</label>
              <select
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                value={form.method}
                onChange={(e) => setForm(f => ({ ...f, method: e.target.value }))}
              >
                <option value="WIRE_TRANSFER">Wire Transfer</option>
                <option value="CHECK">Check</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg border hover:bg-secondary transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={saving || !form.invoiceId}
            className="px-5 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-primary/20"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Record
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, invRes] = await Promise.all([
        api.get<Payment[]>('/finance/payments'),
        api.get<Invoice[]>('/finance/invoices'),
      ]);
      setPayments(payRes.data);
      setInvoices(invRes.data);
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = payments.filter(p =>
    p.invoice.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
    p.method.toLowerCase().includes(search.toLowerCase())
  );

  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 uppercase">
            <IndianRupee className="text-primary" size={20} />
            Collection History
          </h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">
            Track incoming payments and reconcile invoices.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all hover:scale-105 flex items-center gap-2"
        >
          <Plus size={14} /> Record Payment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
        {[
          { label: 'Total Received', value: `₹${(totalReceived / 100000).toFixed(2)}L`, icon: TrendingUp, color: 'from-emerald-400 to-teal-600', bg: 'bg-emerald-500/10' },
          { label: 'Avg Payment Size', value: `₹${(payments.length ? (totalReceived / payments.length) : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: CreditCard, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-500/10' },
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
          placeholder="Filter by invoice or method..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-1.5 rounded-lg border bg-background/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
        />
      </div>

      {/* Payments Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden mx-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="py-3 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Transaction ID</th>
                <th className="py-3 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Date</th>
                <th className="py-3 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Invoice No</th>
                <th className="py-3 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Method</th>
                <th className="py-3 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Amount</th>
                <th className="py-3 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto opacity-50" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center opacity-60">
                    <IndianRupee className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest">No payments recorded</p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="group hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-6">
                      <p className="font-bold text-xs uppercase tracking-tighter opacity-70">TRN-{p.id.substring(0, 8)}</p>
                    </td>
                    <td className="py-3 px-6 text-xs font-bold">
                      {new Date(p.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-1.5">
                        <FileText size={10} className="text-primary opacity-50" />
                        <span className="text-xs font-black uppercase tracking-tight">{p.invoice.invoiceNo}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-xs font-black uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                        {p.method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <p className="font-black text-xs text-foreground tracking-tighter flex items-center gap-1 text-emerald-600">
                        <ArrowDownLeft size={12} strokeWidth={3} />
                        ₹{p.amount.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <span className="px-2 py-0.5 text-xs font-black uppercase tracking-widest rounded-full border bg-emerald-500/10 text-emerald-600 border-emerald-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <RecordPaymentModal
          invoices={invoices}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
