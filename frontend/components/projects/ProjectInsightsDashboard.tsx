'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import {
  Activity, Wallet, TrendingUp, AlertCircle, Clock, AlertTriangle,
  CheckCircle2, BrainCircuit, Bug, Calendar, Filter, GitBranch,
  FlaskConical,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils';

export default function ProjectInsightsDashboard({ projectId, onTabChange }: { projectId: string; onTabChange?: (tab: string) => void }) {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');

  const loadInsights = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (milestoneId) params.append('milestoneId', milestoneId);
      const res = await api.get(`/dashboard/project/${projectId}/insights?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInsights(); }, [projectId]);

  if (loading && !data) return <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">Loading insights...</div>;
  if (!data || Object.keys(data).length === 0) return <div className="text-center py-10 text-xs text-muted-foreground">Unable to load dashboard data.</div>;

  const {
    health = { overallProgress: 0 },
    financials = { totalBudget: 0, totalPaid: 0, actualCost: 0, profitMargin: 0 },
    resourceBandwidth = [],
    risks = { slaBreaches: 0, overdueTasks: 0, highPriorityBugs: 0 },
    quality = { defectDensity: 0, totalBugs: 0, testStats: { total: 0, passed: 0, failed: 0, skipped: 0 } },
    taskProgress = { counts: {} },
    productivity = { trend: [] },
    changeRequests = { total: 0, approved: 0, pending: 0, budgetImpact: 0 },
    aiPredictions = [],
    timeline = [],
  } = data;

  const role = user?.role || '';
  const canViewFinancials = ['ADMIN', 'PM', 'MANAGEMENT'].includes(role);

  const taskPieData = Object.entries(taskProgress.counts || {}).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#6366f1', '#64748b'];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg p-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter size={12} /> Filters:
        </div>
        <input
          type="date"
          className="field-input w-auto"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          className="field-input w-auto"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
        />
        <select
          className="field-select w-auto"
          value={milestoneId}
          onChange={e => setMilestoneId(e.target.value)}
        >
          <option value="">All Milestones</option>
          {timeline?.map((m: any) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button onClick={loadInsights} className="btn-primary btn-sm">Apply</button>
      </div>

      {/* Row 1: Health & Financials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onTabChange?.('tasks')}
        >
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <Activity size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">Project Health</span>
          </div>
          <div className="text-xl font-bold">{Math.round(health.overallProgress)}%</div>
          <p className="text-xs text-muted-foreground mt-0.5">Overall Completion</p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${health.overallProgress}%` }} />
          </div>
        </div>

        <div
          className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onTabChange?.('tickets')}
        >
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <Bug size={14} className="text-red-500" />
            <span className="text-xs font-semibold text-foreground">Quality Score</span>
          </div>
          <div className="text-xl font-bold">{quality.defectDensity.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground mt-0.5">Defect Density</p>
          <div className="mt-2 pt-2 border-t space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tests Passed</span>
              <span className="font-medium text-emerald-600">{quality.testStats?.passed || 0} / {quality.testStats?.total || 0}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${quality.testStats?.total ? (quality.testStats.passed / quality.testStats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {canViewFinancials ? (
          <>
            <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                <Wallet size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-foreground">Total Budget</span>
              </div>
              <div className="text-lg font-bold">₹{financials.totalBudget.toLocaleString('en-IN')}</div>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">₹{financials.totalPaid.toLocaleString('en-IN')} Collected</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                <TrendingUp size={14} className="text-amber-500" />
                <span className="text-xs font-semibold text-foreground">Cost Burn</span>
              </div>
              <div className="text-lg font-bold text-red-600">₹{financials.actualCost.toLocaleString('en-IN')}</div>
              <p className="text-xs text-amber-600 font-medium mt-0.5">Est. Margin: {Math.round(financials.profitMargin)}%</p>
            </div>
          </>
        ) : (
          <div className="col-span-2 bg-muted/40 border border-dashed border-border rounded-lg p-3 flex items-center justify-center text-xs text-muted-foreground">
            Financial metrics restricted to PM and Management.
          </div>
        )}
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm flex flex-col">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><CheckCircle2 size={13} /> Task Progress</h3>
          <div className="h-[200px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={taskPieData} innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                  {taskPieData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie>
                <RechartsTooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 shadow-sm flex flex-col">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Activity size={13} /> Productivity Trend</h3>
          <div className="h-[200px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productivity.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="billable" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Billable Hrs" />
                <Area type="monotone" dataKey="nonBillable" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} name="Non-Billable" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Resource Utilization & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2 bg-card border border-border rounded-lg p-3 shadow-sm flex flex-col">
          <h3 className="text-xs font-semibold mb-3">Resource Utilization vs Allocation</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resourceBandwidth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="expectedHours" name="Expected Hrs" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="loggedHours" name="Logged Hrs" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-1 bg-card border border-border rounded-lg p-3 shadow-sm overflow-hidden flex flex-col">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Calendar size={13} /> Milestones</h3>
          <div className="overflow-y-auto pr-1 space-y-3 flex-1">
            {timeline?.length === 0 && <p className="text-xs text-muted-foreground">No milestones defined.</p>}
            {timeline?.map((m: any, idx: number) => (
              <div key={idx} className="relative pl-3 border-l-2 border-primary/20 pb-3 last:pb-0">
                <div className="absolute w-1.5 h-1.5 bg-primary rounded-full -left-[4px] top-1 ring-2 ring-background" />
                <p className="text-xs font-medium">{m.name}</p>
                {m.dueDate && <p className="text-xs text-muted-foreground">Due: {new Date(m.dueDate).toLocaleDateString()}</p>}
                <div className="flex items-center gap-1.5 mt-1 text-xs">
                  <span className={cn('px-1.5 py-0.5 rounded text-xs', m.status === 'ACHIEVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>{m.status}</span>
                  <span className="text-muted-foreground">{m.completion}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Risks, QA, CR, AI */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Risks */}
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
          <h3 className="text-xs font-semibold text-red-600 mb-2.5 flex items-center gap-1.5"><AlertTriangle size={13} /> Active Risks</h3>
          <div className="space-y-1.5">
            {[
              { label: 'SLA Breaches', value: risks.slaBreaches, icon: <Clock size={12} className="text-red-500" />, tab: 'tickets', bg: 'bg-red-50/50 hover:bg-red-100/50' },
              { label: 'Overdue Tasks', value: risks.overdueTasks, icon: <AlertTriangle size={12} className="text-amber-500" />, tab: 'tasks', bg: 'hover:bg-muted/50' },
              { label: 'High/Critical Bugs', value: risks.highPriorityBugs, icon: <Bug size={12} className="text-amber-500" />, tab: 'risks', bg: 'hover:bg-muted/50' },
              { label: 'High Priority Tasks', value: risks.highPriorityTasks, icon: <AlertCircle size={12} className="text-amber-500" />, tab: 'tasks', bg: 'hover:bg-muted/50' },
            ].map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-2 border border-border rounded cursor-pointer transition-colors ${r.bg}`}
                onClick={() => onTabChange?.(r.tab)}
              >
                <div className="flex items-center gap-1.5">
                  {r.icon}
                  <span className="text-xs">{r.label}</span>
                </div>
                <span className="text-xs font-semibold">{r.value ?? 0}</span>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-1">
              {Object.entries(risks.breakdown?.severity || {}).map(([sev, count]) => (
                <div key={sev} className="text-[10px] bg-muted/30 p-1 rounded flex justify-between">
                  <span className="uppercase opacity-60">{sev}</span>
                  <span>{count as any}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QA */}
        <div
          className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-pointer hover:border-primary/30 transition-all group"
          onClick={() => window.location.href = `/test-management?projectId=${projectId}`}
        >
          <h3 className="text-xs font-semibold text-emerald-600 mb-2.5 flex items-center gap-1.5">
            <FlaskConical size={13} /> QA Insights
          </h3>
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Defect Density</p>
                <p className="text-lg font-bold">{quality.defectDensity.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground mb-0.5">Total Defects</p>
                <p className="text-sm font-semibold">{quality.totalBugs}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Test Pass Rate</span>
                <span className="font-medium">{Math.round((quality.testStats.passed / (quality.testStats.total || 1)) * 100)}%</span>
              </div>
              <div className="flex h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="bg-emerald-500" style={{ width: `${(quality.testStats.passed / (quality.testStats.total || 1)) * 100}%` }} />
                <div className="bg-red-500" style={{ width: `${(quality.testStats.failed / (quality.testStats.total || 1)) * 100}%` }} />
                <div className="bg-amber-500" style={{ width: `${(quality.testStats.skipped / (quality.testStats.total || 1)) * 100}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div className="text-[10px] text-center p-1 bg-emerald-50 text-emerald-700 rounded">{quality.testStats.passed} Pass</div>
                <div className="text-[10px] text-center p-1 bg-red-50 text-red-700 rounded">{quality.testStats.failed} Fail</div>
                <div className="text-[10px] text-center p-1 bg-amber-50 text-amber-700 rounded">{quality.testStats.skipped} Skip</div>
              </div>
            </div>
            <p className="text-[10px] text-center text-muted-foreground group-hover:text-primary transition-colors">View Test Cases →</p>
          </div>
        </div>

        {/* Change Requests */}
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
          <h3 className="text-xs font-semibold text-primary mb-2.5 flex items-center gap-1.5"><GitBranch size={13} /> Change Requests</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-muted/20 rounded">
                <p className="text-[10px] text-muted-foreground mb-0.5">Total CRs</p>
                <p className="text-base font-bold">{changeRequests.total}</p>
              </div>
              <div className="p-2 bg-emerald-50/50 rounded">
                <p className="text-[10px] text-emerald-600 mb-0.5">Approved</p>
                <p className="text-base font-bold text-emerald-700">{changeRequests.approved}</p>
              </div>
            </div>
            <div className="p-2 border border-dashed border-border rounded bg-amber-50/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs">Budget Impact</span>
                <span className={cn('text-xs font-semibold', changeRequests.budgetImpact > 0 ? 'text-red-600' : 'text-emerald-600')}>
                  ₹{Math.abs(changeRequests.budgetImpact).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${changeRequests.total > 0 ? (changeRequests.pending / changeRequests.total) * 100 : 0}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{changeRequests.pending} Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Predictions */}
        <div className="bg-card border border-border border-indigo-100 rounded-lg p-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          <h3 className="text-xs font-semibold text-indigo-700 mb-2.5 flex items-center gap-1.5 relative z-10"><BrainCircuit size={13} /> AI Risk Signals</h3>
          <div className="space-y-2 relative z-10">
            {aiPredictions?.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No recent assessments.</p>
            ) : (
              aiPredictions?.map((p: any, i: number) => (
                <div key={i} className="p-2 border border-indigo-100 bg-card/80 rounded shadow-sm">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-indigo-600 uppercase tracking-wide">{p.module}</span>
                    <div className={cn('w-1.5 h-1.5 rounded-full', p.riskScore > 0.6 ? 'bg-red-500' : p.riskScore > 0.3 ? 'bg-amber-500' : 'bg-emerald-500')} />
                  </div>
                  <p className="text-xs font-medium">{p.predictedValue}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{Math.round(p.confidence * 100)}% confidence</span>
                    <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full', p.riskScore > 0.6 ? 'bg-red-500' : p.riskScore > 0.3 ? 'bg-amber-500' : 'bg-emerald-500')}
                        style={{ width: `${Math.max(5, p.riskScore * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
