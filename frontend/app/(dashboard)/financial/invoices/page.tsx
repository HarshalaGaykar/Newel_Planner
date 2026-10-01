'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Loader2,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Check,
  Ban,
  TrendingUp,
  IndianRupee,
  Eye,
  X,
  UserCheck,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceType: string; // MILESTONE | TM | RETAINER
  total: number;
  subTotal: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  status: string;
  createdAt: string;
  cfoApproved: boolean;
  financeApproved: boolean;
  clientPo: {
    id: string;
    poNumber: string;
    placeOfSupply: string | null;
    project: { id: string; name: string; type: string };
  } | null;
  milestone: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  payments: { amount: number; paymentDate: string; method: string }[];
  tmBillingRun?: { periodStart: string; periodEnd: string; totalHours: number } | null;
}

// ─── Invoice Details Modal ───────────────────────────────────────────────────

function InvoiceDetailsModal({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b bg-muted/10">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-black text-lg uppercase tracking-tight">{invoice.invoiceNo}</h2>
              <span className={cn(
                'px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full border shadow-sm',
                invoice.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                invoice.status === 'SENT' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                'bg-amber-500/10 text-amber-600 border-amber-200'
              )}>
                {invoice.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Generated on {new Date(invoice.createdAt).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          <div className="grid grid-cols-2 gap-8">
            {/* Left: Project & Billing Info */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Project Details</label>
                <div className="p-4 border rounded-2xl bg-primary/[0.03] border-primary/10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight">
                        {invoice.clientPo?.project.name ?? invoice.project?.name ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                        {invoice.clientPo?.project.type ?? invoice.invoiceType}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {invoice.clientPo && (
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Reference PO</label>
                    <div className="p-3 border rounded-xl bg-muted/5">
                      <p className="font-bold text-xs">{invoice.clientPo.poNumber}</p>
                      <p className="text-xs text-muted-foreground font-bold uppercase mt-0.5">Supply: {invoice.clientPo.placeOfSupply || 'Domestic'}</p>
                    </div>
                  </div>
                )}
                {invoice.milestone && (
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Milestone</label>
                    <div className="p-3 border rounded-xl bg-muted/5">
                      <p className="font-bold text-xs">{invoice.milestone.name}</p>
                    </div>
                  </div>
                )}
                {invoice.tmBillingRun && (
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">T&M Period</label>
                    <div className="p-3 border rounded-xl bg-muted/5">
                      <p className="font-bold text-xs">
                        {new Date(invoice.tmBillingRun.periodStart).toLocaleDateString()} → {new Date(invoice.tmBillingRun.periodEnd).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground font-bold uppercase mt-0.5">{invoice.tmBillingRun.totalHours.toFixed(1)} hrs billed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Approval Status */}
            <div className="space-y-4">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Approvals</label>
              <div className="space-y-3">
                <div className={cn("flex items-center justify-between p-4 rounded-xl border transition-all", invoice.financeApproved ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm" : "bg-muted/10 border-dashed text-muted-foreground")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("p-1.5 rounded-lg", invoice.financeApproved ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                      <UserCheck size={16} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">Finance Manager</span>
                  </div>
                  {invoice.financeApproved ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Clock size={16} className="opacity-50" />}
                </div>
                <div className={cn("flex items-center justify-between p-4 rounded-xl border transition-all", invoice.cfoApproved ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm" : "bg-muted/10 border-dashed text-muted-foreground")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("p-1.5 rounded-lg", invoice.cfoApproved ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                      <UserCheck size={16} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">CFO Approval</span>
                  </div>
                  {invoice.cfoApproved ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Clock size={16} className="opacity-50" />}
                </div>
              </div>
            </div>
          </div>

          {/* Amount Breakdown */}
          <div className="border rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-muted/30 px-5 py-3 border-b">
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Amount Breakdown</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Subtotal</span>
                <span className="font-black">₹{invoice.subTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="space-y-2 pl-4 border-l-2 border-primary/20 bg-primary/[0.01] py-2">
                {invoice.cgst > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-bold uppercase tracking-widest opacity-70">CGST (9%)</span>
                    <span className="font-bold">₹{invoice.cgst.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {invoice.sgst > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-bold uppercase tracking-widest opacity-70">SGST (9%)</span>
                    <span className="font-bold">₹{invoice.sgst.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {invoice.igst > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-bold uppercase tracking-widest opacity-70">IGST (18%)</span>
                    <span className="font-bold">₹{invoice.igst.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-4 border-t-2 border-dashed text-xl font-black tracking-tighter text-primary">
                <span className="uppercase text-xs tracking-[0.2em] mt-2 opacity-70">Total Payable</span>
                <span>₹{invoice.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {invoice.payments.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Payment History</label>
              <div className="space-y-2">
                {invoice.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-200/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600">
                        <IndianRupee size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">₹{p.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">{p.method.replace('_', ' ')} · {new Date(p.paymentDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">Success</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
        
        {/* Modal Footer */}
        <div className="p-6 border-t bg-muted/5 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-foreground text-background rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg">Close View</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Invoice[]>('/finance/invoices');
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: 'approve' | 'send' | 'void') => {
    try {
      if (action === 'approve') {
        await api.patch(`/finance/invoice/${id}/approve`, { role: user?.role });
      } else if (action === 'send') {
        await api.patch(`/finance/invoice/${id}/send`);
      } else if (action === 'void') {
        if (!confirm('Are you sure you want to void this invoice?')) return;
        await api.patch(`/finance/invoice/${id}/void`);
      }
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message || `Failed to ${action} invoice`);
    }
  };

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(q) ||
      (inv.clientPo?.poNumber ?? '').toLowerCase().includes(q) ||
      (inv.milestone?.name ?? '').toLowerCase().includes(q) ||
      (inv.clientPo?.project.name ?? inv.project?.name ?? '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter(i => i.status === 'SENT' || i.status === 'DRAFT').reduce((s, i) => s + i.total, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50';
      case 'SENT': return 'bg-blue-500/10 text-blue-600 border-blue-200/50';
      case 'DRAFT': return 'bg-amber-500/10 text-amber-600 border-amber-200/50';
      case 'VOID': return 'bg-rose-500/10 text-rose-600 border-rose-200/50';
      default: return 'bg-slate-500/10 text-muted-foreground border-slate-200/50';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 uppercase">
            <FileText className="text-primary" size={22} />
            Invoices
          </h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">
            Manage client billing and collection lifecycle.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2">
        {[
          { label: 'Total Invoiced', value: `₹${(totalInvoiced / 100000).toFixed(1)}L`, icon: TrendingUp, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-500/10' },
          { label: 'Collection (Paid)', value: `₹${(totalPaid / 100000).toFixed(1)}L`, icon: CheckCircle2, color: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-500/10' },
          { label: 'Pending Payment', value: `₹${(totalPending / 100000).toFixed(1)}L`, icon: Clock, color: 'from-amber-400 to-orange-500', bg: 'bg-amber-500/10' },
        ].map((stat, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all group">
            <div className={cn('absolute top-0 right-0 w-20 h-20 -mr-4 -mt-4 rounded-full opacity-10 blur-xl transition-all group-hover:opacity-20', `bg-gradient-to-br ${stat.color}`)} />
            <div className="flex items-center justify-between mb-2 relative z-10">
              <div className={cn('p-2 rounded-xl border border-border/50', stat.bg)}>
                <stat.icon size={16} className="text-primary" />
              </div>
              <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] text-right opacity-70">{stat.label}</span>
            </div>
            <h3 className="text-xl font-black text-foreground tracking-tighter relative z-10">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-2">
        <div className="relative w-full sm:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={16} />
          <input
            type="text"
            placeholder="Search invoices, projects or POs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border bg-background/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-background border rounded-xl px-3 py-1.5 shadow-inner">
            <Filter size={14} className="text-muted-foreground" />
            <select
              className="bg-transparent text-xs font-black uppercase tracking-widest outline-none cursor-pointer"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden mx-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="py-3.5 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Invoice No</th>
                <th className="py-3.5 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Type</th>
                <th className="py-3.5 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Project / PO</th>
                <th className="py-3.5 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Amount</th>
                <th className="py-3.5 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Status</th>
                <th className="py-3.5 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Approvals</th>
                <th className="py-3.5 px-6 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto opacity-50" />
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-4">Fetching invoices...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center opacity-60">
                    <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest">No invoices found</p>
                  </td>
                </tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} className="group hover:bg-muted/10 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-xs uppercase tracking-tight group-hover:text-primary transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>{inv.invoiceNo}</p>
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest opacity-60">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-black uppercase tracking-widest',
                        inv.invoiceType === 'TM' ? 'bg-purple-100 text-purple-700' :
                        inv.invoiceType === 'RETAINER' ? 'bg-blue-100 text-blue-700' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {inv.invoiceType ?? 'MILESTONE'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-xs font-black text-foreground uppercase tracking-tighter truncate max-w-[180px]">
                        {inv.clientPo?.project.name ?? inv.project?.name ?? '—'}
                      </p>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                        {inv.clientPo?.poNumber ?? inv.invoiceType}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-black text-xs text-foreground tracking-tighter">₹{inv.total.toLocaleString('en-IN')}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        'px-2.5 py-0.5 text-xs font-black uppercase tracking-widest rounded-full border shadow-sm inline-flex items-center gap-1.5',
                        getStatusBadge(inv.status)
                      )}>
                        {inv.status === 'PAID' && <CheckCircle2 size={10} className="text-emerald-500" />}
                        {inv.status === 'SENT' && <Send size={10} className="text-blue-500" />}
                        {inv.status === 'DRAFT' && <Clock size={10} className="text-amber-500" />}
                        {inv.status === 'VOID' && <Ban size={10} className="text-rose-500" />}
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-black uppercase transition-all shadow-sm",
                          inv.financeApproved ? "bg-emerald-500 border-emerald-600 text-white" : "bg-muted border-border/50 text-muted-foreground opacity-50"
                        )} title="Finance Approval">F</div>
                        <div className={cn(
                          "w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-black uppercase transition-all shadow-sm",
                          inv.cfoApproved ? "bg-emerald-500 border-emerald-600 text-white" : "bg-muted border-border/50 text-muted-foreground opacity-50"
                        )} title="CFO Approval">C</div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1.5 rounded-lg bg-primary/5 hover:bg-primary/20 text-primary transition-all flex items-center gap-1.5"
                          title="View Details"
                        >
                          <Eye size={16} />
                          <span className="text-xs font-black uppercase tracking-widest hidden lg:inline">View</span>
                        </button>
                        <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          {inv.status === 'DRAFT' && (['ADMIN', 'FINANCE', 'PM'].includes(user?.role || '')) && (
                            <button
                              onClick={() => handleAction(inv.id, 'approve')}
                              className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-600 transition-colors"
                              title="Approve Invoice"
                            >
                              <Check size={16} strokeWidth={3} />
                            </button>
                          )}
                          {inv.status === 'DRAFT' && (inv.financeApproved || inv.cfoApproved || ['ADMIN'].includes(user?.role || '')) && (
                            <button
                              onClick={() => handleAction(inv.id, 'send')}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-600 transition-colors"
                              title="Send to Client"
                            >
                              <Send size={16} />
                            </button>
                          )}
                          {inv.status !== 'VOID' && inv.status !== 'PAID' && (
                            <button
                              onClick={() => handleAction(inv.id, 'void')}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-600 transition-colors"
                              title="Void Invoice"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="px-2 pb-10">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest italic opacity-40">
          * CFO and Finance approvals are mandatory for high-value invoices ( &gt; ₹10k ) before client distribution.
        </p>
      </div>

      {selectedInvoice && (
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
