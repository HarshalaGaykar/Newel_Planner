'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  FileText, TrendingUp,
  Target, Clock, CheckCircle2, ListFilter, ShieldAlert
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface MarginRow {
  projectId: string;
  projectName: string;
  revenue: number;
  totalCost: number;
  margin: number;
  employeeCost: number;
  freelancerCost: number;
  expenses: number;
}

export default function FinancialDashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [marginData, setMarginData] = useState<MarginRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/finance/summary'),
      api.get('/finance/margin-summary'),
    ])
      .then(([summaryRes, marginRes]) => {
        setSummary(summaryRes.data);
        setMarginData(marginRes.data);
      })
      .catch(err => console.error('Failed to fetch financial data:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Gathering Financial Intelligence...</p>
        </div>
      </div>
    );
  }

  const AccessDenied = (
    <div className="p-12 flex flex-col items-center justify-center text-center bg-card border rounded-3xl shadow-2xl max-w-2xl mx-auto my-12">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
        <ShieldAlert size={40} />
      </div>
      <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">Insufficient Clearance</h2>
      <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs max-w-sm">
        You do not have the required systemic permissions to access high-level financial intelligence.
      </p>
    </div>
  );

  if (!summary) return <div className="p-8 text-center font-bold text-red-500">Error loading data.</div>;

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
  const pieData = Object.entries(summary.statusBreakdown).map(([name, value]) => ({ name, value: value as number }));

  const totalEmployeeCost = marginData.reduce((s, r) => s + r.employeeCost, 0);
  const totalFreelancerCost = marginData.reduce((s, r) => s + r.freelancerCost, 0);
  const totalExpenses = marginData.reduce((s, r) => s + r.expenses, 0);
  const costDonutData = [
    { name: 'Employee', value: totalEmployeeCost },
    { name: 'Freelancer', value: totalFreelancerCost },
    { name: 'Overhead', value: totalExpenses },
  ].filter(d => d.value > 0);
  const COST_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B'];

  const revenueCostTrend = summary.monthlyTrends.map((m: any) => ({
    month: m.month,
    revenue: m.invoiced,
    collected: m.received,
  }));

  const getMarginBg = (margin: number) => {
    if (margin >= 30) return 'bg-green-100 text-green-700';
    if (margin >= 10) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-600';
  };

  return (
    <PermissionGuard permission="FINANCIAL_DASHBOARD_VIEW" fallback={AccessDenied}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Financial Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-xs font-bold uppercase tracking-[0.2em]">Enterprise Resource Revenue Monitoring</p>
          </div>
          <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-border shadow-sm">
            <div className="px-3 py-1.5 bg-muted rounded-lg text-xs font-black text-muted-foreground uppercase tracking-widest">Last Updated: {new Date().toLocaleTimeString()}</div>
            <button className="p-1.5 hover:bg-muted rounded-lg transition">
              <ListFilter className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total PO Value', value: summary.metrics.totalPOAmount, icon: FileText, color: 'text-foreground', bg: 'bg-muted', trend: '+12% vs last mo' },
            { label: 'Total Invoiced', value: summary.metrics.totalInvoiced, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50', trend: '84% of PO value' },
            { label: 'Revenue Collected', value: summary.metrics.totalReceived, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', trend: '↑ ₹45k this month' },
            { label: 'Outstanding', value: summary.metrics.outstandingAmount, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'Pending collection' },
          ].map((stat, i) => (
            <div key={i} className="bg-card p-4 rounded-xl border border-border shadow-lg shadow-sm/20 relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-20 h-20 ${stat.bg} opacity-10 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700`}></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest">{stat.trend}</div>
                </div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
                <h2 className={`text-lg font-black ${stat.color}`}>₹{stat.value.toLocaleString()}</h2>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border shadow-md/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Revenue Trends</h3>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Invoiced vs Collected (Last 6 Months)</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-black text-muted-foreground uppercase">Invoiced</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span className="text-xs font-black text-muted-foreground uppercase">Received</span>
                </div>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueCostTrend}>
                  <defs>
                    <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#9CA3AF' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#9CA3AF' }} tickFormatter={(val) => `₹${val / 1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '10px' }} itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                  <Area type="monotone" dataKey="revenue" name="Invoiced" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorInvoiced)" />
                  <Area type="monotone" dataKey="collected" name="Received" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceived)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl border border-border shadow-md/20 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xs font-black text-foreground uppercase tracking-tight text-center">Cost Breakdown</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 text-center">Employee / Freelancer / Overhead</p>
            </div>
            {costDonutData.length > 0 ? (
              <>
                <div className="h-48 w-full relative flex-grow">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={costDonutData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={5} dataKey="value">
                        {costDonutData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COST_COLORS[index % COST_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => `₹${Number(val ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {costDonutData.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between px-2 py-1 bg-muted rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COST_COLORS[index % COST_COLORS.length] }}></div>
                        <span className="text-xs font-black text-muted-foreground uppercase">{entry.name}</span>
                      </div>
                      <span className="text-xs font-black text-muted-foreground">₹{entry.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-grow flex items-center justify-center">
                <p className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest">No cost data yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card p-6 rounded-xl border border-border shadow-md/20 flex flex-col">
            <div className="mb-6">
              <h3 className="text-xs font-black text-foreground uppercase tracking-tight text-center">Invoice Status</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 text-center">Volume Distribution</p>
            </div>
            <div className="h-56 w-full relative flex-grow">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={6} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-xl font-black text-foreground">{pieData.reduce((s, d) => s + d.value, 0)}</div>
                  <div className="text-xs font-black text-muted-foreground uppercase tracking-tighter">Total Invoices</div>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5 p-1.5 bg-muted rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-xs font-black text-muted-foreground uppercase truncate">{entry.name}</span>
                  <span className="text-xs font-black text-muted-foreground ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-md/20 overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Recent Invoices</h3>
              <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline transition">View Registry</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-6 py-3 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-black text-muted-foreground uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.recentInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-muted/50 transition cursor-pointer group">
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-foreground group-hover:text-blue-600 transition">{inv.invoiceNo}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded">{(inv.invoiceType ?? 'MILESTONE')}</span>
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">{new Date(inv.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-widest ${inv.status === 'PAID' ? 'bg-green-100 text-green-600' : inv.status === 'DRAFT' ? 'bg-muted text-muted-foreground' : 'bg-orange-100 text-orange-600'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-xs font-black text-foreground">₹{inv.total.toLocaleString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {marginData.length > 0 && (
          <div className="bg-card rounded-xl border border-border shadow-md/20 overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Margin by Project</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Real-time project profitability overview</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {['Project', 'Revenue', 'Total Cost', 'Employee', 'Freelancer', 'Overhead', 'Margin %'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {marginData
                    .filter(r => r.revenue > 0 || r.totalCost > 0)
                    .sort((a, b) => b.margin - a.margin)
                    .map(row => (
                      <tr key={row.projectId} className="hover:bg-muted/50 transition">
                        <td className="px-5 py-3">
                          <p className="text-xs font-black text-foreground truncate max-w-[160px]">{row.projectName}</p>
                        </td>
                        <td className="px-5 py-3 text-xs font-bold text-foreground">₹{row.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-5 py-3 text-xs font-bold text-foreground">₹{row.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-5 py-3 text-xs font-bold text-blue-600">₹{row.employeeCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-5 py-3 text-xs font-bold text-purple-600">₹{row.freelancerCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-5 py-3 text-xs font-bold text-yellow-600">₹{row.expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getMarginBg(row.margin)}`}>
                            {row.margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border shadow-md/20 overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Ledger Entries</h3>
            <button className="text-xs font-black text-green-600 uppercase tracking-widest hover:underline transition">Full History</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-6 py-3 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">Transaction</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">Reference</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-muted-foreground uppercase tracking-widest">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.recentPayments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                          <TrendingUp className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-foreground">Payment Received</div>
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter mt-0.5">{new Date(p.paymentDate).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-black text-muted-foreground uppercase tracking-widest">{p.invoice.invoiceNo}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-xs font-black text-green-600">+₹{p.amount.toLocaleString()}</div>
                      <div className="text-xs font-bold text-muted-foreground/50 uppercase mt-0.5">Cleared</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
