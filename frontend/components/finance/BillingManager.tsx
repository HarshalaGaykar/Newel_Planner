'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { 
  Plus, 
  FileText, 
  Target, 
  Receipt, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function BillingManager({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<'pos' | 'milestones' | 'invoices'>('pos');
  const [clientPOs, setClientPOs] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [poRes, milRes, invRes] = await Promise.all([
        api.get(`/finance/client-po?projectId=${projectId}`),
        api.get(`/finance/milestones?projectId=${projectId}`),
        api.get(`/finance/invoices?projectId=${projectId}`)
      ]);
      setClientPOs(poRes.data);
      setMilestones(milRes.data);
      setInvoices(invRes.data);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalPO: clientPOs.reduce((sum, po) => sum + po.amount, 0),
    totalInvoiced: invoices.reduce((sum, inv) => sum + inv.subTotal, 0),
    totalCollected: invoices.reduce((sum, inv) => 
      sum + inv.payments.reduce((pSum: number, p: any) => pSum + p.amount, 0), 0
    )
  };

  const chartData = [
    { name: 'Invoiced', value: stats.totalInvoiced, color: '#2563eb' },
    { name: 'Remaining', value: Math.max(0, stats.totalPO - stats.totalInvoiced), color: '#f3f4f6' }
  ];

  if (loading) return <div className="p-20 text-center font-black text-muted-foreground/50 animate-pulse">Loading financial data...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-muted/50 min-h-screen">
      {/* Header & Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h1 className="text-4xl font-black text-foreground tracking-tight mb-2">Billing & Revenue</h1>
          <p className="text-muted-foreground font-bold">Manage Client POs, Milestones, and Invoicing hierarchy.</p>
          
          <div className="flex gap-4 mt-8">
            {['pos', 'milestones', 'invoices'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === tab 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                {tab.replace('pos', 'Client POs')}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card p-8 rounded-xl border border-border shadow-xl flex items-center gap-8">
          <div className="h-32 w-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">PO Utilization</div>
            <div className="text-3xl font-black text-foreground">
              {((stats.totalInvoiced / stats.totalPO) * 100 || 0).toFixed(1)}%
            </div>
            <div className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              ₹{stats.totalInvoiced.toLocaleString()} / ₹{stats.totalPO.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="bg-card rounded-xl border border-border shadow-lg/50 overflow-hidden min-h-[500px]">
        {activeTab === 'pos' && (
          <div className="p-10 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" />
                Active Client POs
              </h2>
              <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition">
                <Plus className="w-4 h-4" /> New Client PO
              </button>
            </div>

            <div className="grid gap-6">
              {clientPOs.map((po) => (
                <div key={po.id} className="p-8 rounded-xl border border-border bg-muted/50 hover:bg-card hover:border-blue-100 transition-all group">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">PO</div>
                      <div>
                        <div className="text-lg font-black text-foreground">{po.poNumber}</div>
                        <div className="text-xs font-bold text-muted-foreground">Total Budget: ₹{po.amount.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Status</div>
                      <span className="px-4 py-1.5 rounded-full bg-green-100 text-green-600 text-xs font-black uppercase tracking-widest">
                        {po.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-black text-muted-foreground uppercase">
                      <span>Invoicing Progress</span>
                      <span className="text-blue-600">
                        {((po.invoices?.reduce((s: number, i: any) => s + i.subTotal, 0) / po.amount) * 100 || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(po.invoices?.reduce((s: number, i: any) => s + i.subTotal, 0) / po.amount) * 100 || 0}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="p-10 space-y-8">
            <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
              <Target className="w-6 h-6 text-orange-600" />
              Milestone Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-black text-muted-foreground uppercase tracking-widest border-b border-border">
                    <th className="pb-6 text-left">Milestone</th>
                    <th className="pb-6 text-center">Completion</th>
                    <th className="pb-6 text-right">Budget</th>
                    <th className="pb-6 text-right">Invoiced</th>
                    <th className="pb-6 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {milestones.map((m) => {
                    const invoiced = m.invoices?.reduce((s: number, i: any) => s + i.subTotal, 0) || 0;
                    const isOverbilled = invoiced > m.amount;
                    
                    return (
                      <tr key={m.id} className="group hover:bg-muted/50 transition">
                        <td className="py-6">
                          <div className="text-sm font-black text-foreground">{m.name}</div>
                          <div className="text-xs font-bold text-muted-foreground uppercase">{m.status}</div>
                        </td>
                        <td className="py-6 text-center">
                          <div className="inline-flex items-center gap-2 text-xs font-black text-blue-600">
                            {m.completion}%
                          </div>
                        </td>
                        <td className="py-6 text-right text-sm font-black text-foreground">₹{m.amount.toLocaleString()}</td>
                        <td className="py-6 text-right">
                          <div className={`text-sm font-black ${isOverbilled ? 'text-red-600' : 'text-foreground'}`}>
                            ₹{invoiced.toLocaleString()}
                          </div>
                          {isOverbilled && (
                            <div className="text-xs font-black text-red-500 uppercase flex items-center justify-end gap-1">
                              <AlertCircle className="w-2 h-2" /> Overbilled
                            </div>
                          )}
                        </td>
                        <td className="py-6 text-center">
                          <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 px-4 py-2 rounded-xl transition">
                            Generate Invoice
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="p-10 space-y-8">
             <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
              <Receipt className="w-6 h-6 text-green-600" />
              Invoice Tracking
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {invoices.map((inv) => {
                const paid = inv.payments?.reduce((s: number, p: any) => s + p.amount, 0) || 0;
                const isPaid = paid >= inv.total;
                
                return (
                  <div key={inv.id} className="bg-card border border-border rounded-3xl p-6 hover:shadow-xl transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`p-3 rounded-2xl ${isPaid ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                        <Receipt className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-muted-foreground uppercase tracking-widest">Invoice #</div>
                        <div className="text-sm font-black text-foreground">{inv.invoiceNo}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-1 mb-6">
                      <div className="text-2xl font-black text-foreground">₹{inv.total.toLocaleString()}</div>
                      <div className="text-xs font-bold text-muted-foreground uppercase">
                        Collected: ₹{paid.toLocaleString()}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border flex items-center justify-between">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                        isPaid ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {inv.status}
                      </span>
                      <button className="flex items-center gap-1 text-xs font-black text-blue-600 uppercase tracking-widest hover:gap-2 transition-all">
                        Details <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
