'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { IndianRupee, FileText, CreditCard, Plus, ArrowUpRight, CheckCircle2, TrendingUp, Target } from 'lucide-react';

export default function FinanceDashboard({ projectId }: { projectId: string }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [profitability, setProfitability] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, milRes, poRes, profRes] = await Promise.all([
          api.get(`/finance/invoices?projectId=${projectId}`),
          api.get(`/finance/milestones?projectId=${projectId}`),
          api.get(`/finance/client-po?projectId=${projectId}`),
          api.get(`/finance/profitability/${projectId}`)
        ]);
        setInvoices(invRes.data);
        setMilestones(milRes.data);
        setClientPOs(poRes.data);
        setProfitability(profRes.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const [clientPOs, setClientPOs] = useState<any[]>([]);

  const stats = {
    totalPOValue: clientPOs.reduce((sum, po) => sum + po.amount, 0),
    totalInvoiced: invoices.reduce((sum, inv) => sum + inv.subTotal, 0),
    totalCollected: invoices.reduce((sum, inv) => 
      sum + inv.payments.reduce((pSum: number, p: any) => pSum + p.amount, 0), 0
    ),
    profit: profitability?.grossProfit || 0,
    margin: profitability?.profitMargin || 0,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Project Financials</h1>
          <p className="text-muted-foreground mt-1 font-medium">Tracking POs, Milestones, and Revenue.</p>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition shadow-lg shadow-sm">
            <Plus className="w-4 h-4" />
            New PO
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Client PO Value', value: stats.totalPOValue, icon: FileText, color: 'text-foreground', bg: 'bg-muted' },
          { label: 'Revenue Collected', value: stats.totalCollected, icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Estimated Profit', value: stats.profit, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Profit Margin', value: `${stats.margin.toFixed(1)}%`, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-card p-6 rounded-xl border border-border shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
              <h2 className={`text-2xl font-black ${stat.color}`}>
                {typeof stat.value === 'number' ? `₹${stat.value.toLocaleString()}` : stat.value}
              </h2>
            </div>
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Milestones */}
        <div className="bg-card rounded-xl border border-border shadow-xl overflow-hidden">
          <div className="p-8 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-black text-foreground">Milestone Progress</h3>
            <button className="text-xs font-black text-blue-600 uppercase tracking-widest">Manage Milestones</button>
          </div>
          <div className="p-8 space-y-6">
            {milestones.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground font-bold">No milestones defined for this project.</div>
            ) : milestones.map((m) => (
              <div key={m.id} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-sm font-black text-foreground">{m.name}</div>
                    <div className="text-xs font-bold text-muted-foreground uppercase">₹{m.amount.toLocaleString()} • {m.status}</div>
                  </div>
                  <div className="text-sm font-black text-blue-600">{m.completion}%</div>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${m.completion}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-card rounded-xl border border-border shadow-xl overflow-hidden">
          <div className="p-8 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-black text-foreground">Recent Invoices</h3>
            <button className="text-xs font-black text-blue-600 uppercase tracking-widest">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="p-6 text-xs font-black text-muted-foreground uppercase tracking-widest">Invoice No</th>
                  <th className="p-6 text-xs font-black text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="p-6 text-xs font-black text-muted-foreground uppercase tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="p-6">
                      <div className="text-sm font-black text-foreground">{inv.invoiceNo}</div>
                      <div className="text-xs font-bold text-muted-foreground">Gen: {new Date(inv.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="p-6">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                        inv.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="text-sm font-black text-foreground">₹{inv.total.toLocaleString()}</div>
                      <div className="text-xs font-bold text-blue-600 flex items-center justify-end gap-1">
                        View <ArrowUpRight className="w-3 h-3" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
