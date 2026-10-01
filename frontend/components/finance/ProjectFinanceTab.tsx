'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils';
import {
  Plus, Loader2, Check, X, TrendingUp, Users, DollarSign,
  Receipt, Settings, AlertTriangle,
} from 'lucide-react';

interface CostBreakdown {
  employeeCost: number;
  freelancerCost: number;
  expenses: number;
  totalCost: number;
  budgetCost: number;
  variancePct: number;
  revenue: number;
  margin: number;
}

interface ProjectExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
  invoiceRef?: string;
  vendor?: { vendorName: string } | null;
  addedBy: { firstName?: string; lastName?: string };
}

interface RetainerConfig {
  id: string;
  monthlyAmount: number;
  billingDay: number;
  currency: string;
  isActive: boolean;
}

const EXPENSE_CATEGORIES = ['TRAVEL', 'LICENSE', 'INFRASTRUCTURE', 'VENDOR', 'OTHER'];

export default function ProjectFinanceTab({
  projectId,
  billingModel,
}: {
  projectId: string;
  billingModel: string;
}) {
  const { user } = useAuthStore();
  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [retainerConfig, setRetainerConfig] = useState<RetainerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // T&M Invoice form
  const [tmForm, setTmForm] = useState({ periodStart: '', periodEnd: '' });
  const [showTmForm, setShowTmForm] = useState(false);

  // Retainer config form
  const [showRetainerForm, setShowRetainerForm] = useState(false);
  const [retainerForm, setRetainerForm] = useState({ monthlyAmount: '', billingDay: '1', currency: 'INR', isActive: true });

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: '', amount: '', category: 'TRAVEL', expenseDate: '', invoiceRef: '',
  });
  const [savingExpense, setSavingExpense] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bdRes, expRes] = await Promise.all([
        api.get<CostBreakdown>(`/finance/projects/${projectId}/cost-breakdown`),
        api.get<ProjectExpense[]>(`/finance/expenses?projectId=${projectId}`),
      ]);
      setBreakdown(bdRes.data);
      setExpenses(expRes.data);

      if (billingModel === 'RETAINER') {
        const rcRes = await api.get<RetainerConfig>(`/finance/projects/${projectId}/retainer-config`);
        setRetainerConfig(rcRes.data);
        if (rcRes.data) {
          setRetainerForm({
            monthlyAmount: String(rcRes.data.monthlyAmount),
            billingDay: String(rcRes.data.billingDay),
            currency: rcRes.data.currency,
            isActive: rcRes.data.isActive,
          });
        }
      }
    } catch {
      // pass
    } finally {
      setLoading(false);
    }
  }, [projectId, billingModel]);

  useEffect(() => { load(); }, [load]);

  async function handleGenerateTmInvoice() {
    if (!tmForm.periodStart || !tmForm.periodEnd) return;
    setGeneratingInvoice(true);
    try {
      await api.post(`/finance/projects/${projectId}/tm-invoice`, {
        periodStart: tmForm.periodStart,
        periodEnd: tmForm.periodEnd,
        generatedById: user?.id,
      });
      alert('T&M invoice generated successfully');
      setShowTmForm(false);
      setTmForm({ periodStart: '', periodEnd: '' });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to generate T&M invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  }

  async function handleGenerateRetainerInvoice() {
    const now = new Date();
    setGeneratingInvoice(true);
    try {
      await api.post(`/finance/projects/${projectId}/retainer-invoice`, {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });
      alert('Retainer invoice generated for current month');
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to generate retainer invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  }

  async function handleSaveRetainerConfig() {
    try {
      await api.post(`/finance/projects/${projectId}/retainer-config`, {
        monthlyAmount: Number(retainerForm.monthlyAmount),
        billingDay: Number(retainerForm.billingDay),
        currency: retainerForm.currency,
        isActive: retainerForm.isActive,
      });
      setShowRetainerForm(false);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save retainer config');
    }
  }

  async function handleAddExpense() {
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.expenseDate) return;
    setSavingExpense(true);
    try {
      await api.post('/finance/expenses', {
        projectId,
        description: expenseForm.description,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        expenseDate: expenseForm.expenseDate,
        invoiceRef: expenseForm.invoiceRef || undefined,
        addedById: user?.id,
      });
      setShowExpenseForm(false);
      setExpenseForm({ description: '', amount: '', category: 'TRAVEL', expenseDate: '', invoiceRef: '' });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const marginColor = !breakdown ? '' : breakdown.margin >= 30 ? 'text-emerald-600' : breakdown.margin >= 10 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">

      {/* Cost Breakdown Card */}
      {breakdown && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Cost Breakdown</h2>
            <span className={cn('text-xl font-black', marginColor)}>{breakdown.margin.toFixed(1)}% margin</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Employee Cost', value: breakdown.employeeCost, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Freelancer Cost', value: breakdown.freelancerCost, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Overhead', value: breakdown.expenses, icon: Receipt, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Total Cost', value: breakdown.totalCost, icon: DollarSign, color: 'text-foreground', bg: 'bg-muted' },
            ].map((s) => (
              <div key={s.label} className="bg-background border rounded-lg p-3">
                <div className={cn('w-7 h-7 rounded-lg mb-2 flex items-center justify-center', s.bg)}>
                  <s.icon size={14} className={s.color} />
                </div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-0.5">{s.label}</p>
                <p className={cn('text-sm font-black', s.color)}>₹{s.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 pt-2 border-t text-xs">
            <span className="text-muted-foreground">
              Revenue: <span className="font-black text-foreground">₹{breakdown.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </span>
            {breakdown.budgetCost > 0 && (
              <span className="text-muted-foreground">
                Budget: <span className="font-black text-foreground">₹{breakdown.budgetCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                {' '}
                <span className={cn('font-black', breakdown.variancePct > 10 ? 'text-red-600' : 'text-emerald-600')}>
                  ({breakdown.variancePct > 0 ? '+' : ''}{breakdown.variancePct.toFixed(1)}% vs budget)
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* T&M Invoice Section */}
      {billingModel === 'TM' && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">T&M Invoice</h2>
            <button
              onClick={() => setShowTmForm(!showTmForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90"
            >
              <Plus size={13} /> Generate T&M Invoice
            </button>
          </div>

          {showTmForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Period Start *</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={tmForm.periodStart} onChange={(e) => setTmForm(f => ({ ...f, periodStart: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Period End *</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={tmForm.periodEnd} onChange={(e) => setTmForm(f => ({ ...f, periodEnd: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowTmForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-secondary">Cancel</button>
                <button
                  onClick={handleGenerateTmInvoice}
                  disabled={generatingInvoice || !tmForm.periodStart || !tmForm.periodEnd}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {generatingInvoice ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Generate
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Retainer Config Section */}
      {billingModel === 'RETAINER' && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Retainer Billing</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRetainerForm(!showRetainerForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold hover:bg-secondary"
              >
                <Settings size={13} /> Config
              </button>
              {retainerConfig && (
                <button
                  onClick={handleGenerateRetainerInvoice}
                  disabled={generatingInvoice}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {generatingInvoice ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Generate This Month
                </button>
              )}
            </div>
          </div>

          {retainerConfig && !showRetainerForm && (
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Monthly Amount</p>
                <p className="font-black text-foreground">₹{retainerConfig.monthlyAmount.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Billing Day</p>
                <p className="font-black text-foreground">Day {retainerConfig.billingDay}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                <p className={cn('font-black', retainerConfig.isActive ? 'text-emerald-600' : 'text-red-500')}>
                  {retainerConfig.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          )}

          {!retainerConfig && !showRetainerForm && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-yellow-500" /> No retainer config set. Click Config to add one.
            </p>
          )}

          {showRetainerForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Monthly Amount (₹) *</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={retainerForm.monthlyAmount} onChange={(e) => setRetainerForm(f => ({ ...f, monthlyAmount: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Billing Day (1–28)</label>
                  <input type="number" min={1} max={28} className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={retainerForm.billingDay} onChange={(e) => setRetainerForm(f => ({ ...f, billingDay: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Currency</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                    value={retainerForm.currency} onChange={(e) => setRetainerForm(f => ({ ...f, currency: e.target.value }))} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={retainerForm.isActive}
                      onChange={(e) => setRetainerForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4" />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRetainerForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-secondary">Cancel</button>
                <button
                  onClick={handleSaveRetainerConfig}
                  disabled={!retainerForm.monthlyAmount}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={13} /> Save Config
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expenses Section */}
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Project Expenses</h2>
          <button
            onClick={() => setShowExpenseForm(!showExpenseForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90"
          >
            <Plus size={13} /> Add Expense
          </button>
        </div>

        {showExpenseForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/5">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block">Description *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Expense description..." />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Amount (₹) *</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Category</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={expenseForm.category} onChange={(e) => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Expense Date *</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={expenseForm.expenseDate} onChange={(e) => setExpenseForm(f => ({ ...f, expenseDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Invoice Ref</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
                  value={expenseForm.invoiceRef} onChange={(e) => setExpenseForm(f => ({ ...f, invoiceRef: e.target.value }))}
                  placeholder="Vendor invoice #" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExpenseForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-secondary">Cancel</button>
              <button
                onClick={handleAddExpense}
                disabled={savingExpense || !expenseForm.description || !expenseForm.amount || !expenseForm.expenseDate}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingExpense ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Add
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                {['Date', 'Description', 'Category', 'Amount', 'Vendor / Ref', 'Added By'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-muted/10 transition">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(exp.expenseDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium max-w-[200px] truncate">{exp.description}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs font-black bg-muted text-muted-foreground uppercase">{exp.category}</span>
                  </td>
                  <td className="px-3 py-2 font-black text-xs">₹{exp.amount.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {exp.vendor?.vendorName ?? exp.invoiceRef ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {exp.addedBy.firstName} {exp.addedBy.lastName}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs font-bold text-muted-foreground uppercase opacity-50">
                    No expenses recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
