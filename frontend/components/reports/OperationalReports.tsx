'use client';

import { useState, useEffect } from 'react';
import {
  Download, Loader2, Play, AlertCircle, Users, Clock, TrendingDown,
  Calendar, BarChart2, Milestone, DollarSign, UserCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import AvailabilityReport from './AvailabilityReport';

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function downloadExcel(url: string, params: Record<string, any>, filename: string) {
  const response = await api.get(url, {
    params: { ...params, export: 'excel' },
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ReportCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-6 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="p-2 rounded-xl bg-blue-50 text-blue-600">{icon}</div>
        <div className="flex-1">
          <p className="font-bold text-base">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  );
}

function RunExportBar({
  onRun,
  onExport,
  loading,
  exporting,
}: {
  onRun: () => void;
  onExport: () => void;
  loading: boolean;
  exporting: boolean;
}) {
  return (
    <div className="flex gap-2 mt-4">
      <button
        onClick={onRun}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        Run
      </button>
      <button
        onClick={onExport}
        disabled={exporting || loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-bold hover:bg-secondary transition-colors disabled:opacity-50"
      >
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Export Excel
      </button>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 ml-2">
      {count}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-40" />
      {message}
    </div>
  );
}

// ─── 1. Missing Timesheets ───────────────────────────────────────────────────

function MissingTimesheetsReport({ departments }: { departments: { id: string; name: string }[] }) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const defaultWeek = monday.toISOString().split('T')[0];

  const [weekStart, setWeekStart] = useState(defaultWeek);
  const [deptId, setDeptId] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/missing-timesheets', { params: { weekStart, departmentId: deptId || undefined } });
      setData(res.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcel('/reports/missing-timesheets', { weekStart, departmentId: deptId || undefined }, 'missing-timesheets.xlsx'); }
    finally { setExporting(false); }
  };

  return (
    <ReportCard icon={<Clock size={18} />} title="Missing Timesheets" description="Active employees who haven't submitted a timesheet for the selected week.">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Week Starting</label>
            <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Department</label>
            <select value={deptId} onChange={e => setDeptId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <RunExportBar onRun={run} onExport={exportExcel} loading={loading} exporting={exporting} />

        {data && (
          <div>
            <p className="text-sm font-bold mb-3">
              Missing submissions
              <Badge count={data.totalMissing} />
            </p>
            {data.rows.length === 0 ? (
              <EmptyState message="All employees submitted timesheets for this week." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      {['Code', 'Name', 'Email', 'Department', 'Manager'].map(h => (
                        <th key={h} className="px-4 py-3 font-bold text-muted-foreground text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.rows.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-4 py-3 font-mono text-xs">{r.employeeCode}</td>
                        <td className="px-4 py-3 font-bold">{r.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                        <td className="px-4 py-3">{r.department}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.manager}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </ReportCard>
  );
}

// ─── 2. Pending Approvals ────────────────────────────────────────────────────

function PendingApprovalsReport() {
  const [olderThanDays, setOlderThanDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/pending-approvals', {
        params: { olderThanDays: olderThanDays || undefined },
      });
      setData(res.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcel('/reports/pending-approvals', { olderThanDays: olderThanDays || undefined }, 'pending-approvals.xlsx'); }
    finally { setExporting(false); }
  };

  const moduleColors: Record<string, string> = {
    LEAVE: 'bg-green-100 text-green-700',
    TIMESHEET: 'bg-blue-100 text-blue-700',
    DEMAND: 'bg-purple-100 text-purple-700',
    CR: 'bg-orange-100 text-orange-700',
    PROJECT: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <ReportCard icon={<AlertCircle size={18} />} title="Pending Approvals" description="Workflow instances awaiting action, optionally filtered by age.">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Older Than (days)</label>
            <input type="number" min="0" placeholder="e.g. 2" value={olderThanDays}
              onChange={e => setOlderThanDays(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm w-36 focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        <RunExportBar onRun={run} onExport={exportExcel} loading={loading} exporting={exporting} />

        {data && (
          <div className="space-y-6">
            {Object.keys(data.grouped).length === 0 ? (
              <EmptyState message="No pending approvals found." />
            ) : (
              Object.entries(data.grouped).map(([module, rows]: [string, any]) => (
                <div key={module}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-black', moduleColors[module] ?? 'bg-muted text-foreground')}>
                      {module}
                    </span>
                    <Badge count={rows.length} />
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/30 border-b border-border">
                        <tr>
                          {['Entity Ref', 'Requested By', 'Requested At', 'Age (days)', 'Step', 'Approver'].map(h => (
                            <th key={h} className="px-4 py-3 font-bold text-muted-foreground text-xs">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((r: any, i: number) => (
                          <tr key={i} className="hover:bg-muted/10">
                            <td className="px-4 py-3 font-mono text-xs">{r.entityRef.slice(0, 8)}…</td>
                            <td className="px-4 py-3 font-bold">{r.requestedBy}</td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(r.requestedAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <span className={cn('font-black', r.ageDays > 7 ? 'text-red-600' : r.ageDays > 2 ? 'text-amber-600' : 'text-green-600')}>
                                {r.ageDays}d
                              </span>
                            </td>
                            <td className="px-4 py-3">{r.currentStep}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{r.currentApprover}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </ReportCard>
  );
}

// ─── 3. Over Allocation ──────────────────────────────────────────────────────

function OverAllocationReport() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/over-allocation', { params: { date } });
      setData(res.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcel('/reports/over-allocation', { date }, 'allocation-conflicts.xlsx'); }
    finally { setExporting(false); }
  };

  return (
    <ReportCard icon={<Users size={18} />} title="Allocation Conflicts" description="Resources booked on more than one allocation for the same date.">
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-1 w-fit">
          <label className="text-xs font-bold text-muted-foreground">As of Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <RunExportBar onRun={run} onExport={exportExcel} loading={loading} exporting={exporting} />

        {data.length === 0 && !loading ? null : data.length === 0 ? null : (
          <div className="space-y-4">
            {data.map((u: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <span className="text-lg font-black text-red-600">
                    {u.allocationCount} allocation{u.allocationCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {u.allocations.map((a: any, j: number) => (
                    <span key={j} className="px-2 py-1 rounded-lg bg-muted/50 text-xs font-medium">
                      {a.project}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {data.length === 0 && <EmptyState message="No allocation conflicts on this date." />}
          </div>
        )}
      </div>
    </ReportCard>
  );
}

// ─── 4. Leave Calendar ───────────────────────────────────────────────────────

function LeaveCalendarReport({ departments }: { departments: { id: string; name: string }[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [deptId, setDeptId] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/leave-calendar', {
        params: { month, year, departmentId: deptId || undefined },
      });
      setData(res.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcel('/reports/leave-calendar', { month, year, departmentId: deptId || undefined }, 'leave-calendar.xlsx'); }
    finally { setExporting(false); }
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const buildGrid = (days: any[]) => {
    if (!days?.length) return [];
    const firstDate = new Date(days[0].date);
    const offset = (firstDate.getDay() + 6) % 7;
    const grid: (any | null)[][] = [];
    let week: (any | null)[] = Array(offset).fill(null);
    for (const day of days) {
      week.push(day);
      if (week.length === 7) { grid.push(week); week = []; }
    }
    if (week.length) { while (week.length < 7) week.push(null); grid.push(week); }
    return grid;
  };

  return (
    <ReportCard icon={<Calendar size={18} />} title="Leave Calendar" description="Approved employee leaves visualised as a monthly calendar.">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              {['January','February','March','April','May','June','July','August','September','October','November','December']
                .map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Year</label>
            <input type="number" value={year} onChange={e => setYear(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm w-24 focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Department</label>
            <select value={deptId} onChange={e => setDeptId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <RunExportBar onRun={run} onExport={exportExcel} loading={loading} exporting={exporting} />

        {data && (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {dayNames.map(d => (
                  <div key={d} className="text-center text-xs font-black text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              {buildGrid(data.days).map((week: any[], wi: number) => (
                <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                  {week.map((day, di) => (
                    <div key={di} className={cn(
                      'min-h-[72px] rounded-xl p-1.5 border',
                      day ? (day.employees.length > 0 ? 'border-blue-200 bg-blue-50' : 'border-border bg-card') : 'border-transparent bg-transparent'
                    )}>
                      {day && (
                        <>
                          <p className="text-xs font-bold text-muted-foreground mb-1">
                            {new Date(day.date).getDate()}
                          </p>
                          <div className="space-y-0.5">
                            {day.employees.slice(0, 3).map((e: any, ei: number) => (
                              <div key={ei} className="text-xs bg-blue-600 text-white rounded px-1 py-0.5 truncate" title={`${e.name} — ${e.leaveType}`}>
                                {e.name.split(' ')[0]}
                              </div>
                            ))}
                            {day.employees.length > 3 && (
                              <div className="text-xs text-blue-700 font-bold">+{day.employees.length - 3} more</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ReportCard>
  );
}

// ─── 5. Planned vs Actual ────────────────────────────────────────────────────

function PlannedVsActualReport({ projects }: { projects: { id: string; name: string; projectCode: string | null }[] }) {
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await api.get('/reports/planned-vs-actual', { params: { projectId } });
      setData(res.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    if (!projectId) return;
    setExporting(true);
    try { await downloadExcel('/reports/planned-vs-actual', { projectId }, 'planned-vs-actual.xlsx'); }
    finally { setExporting(false); }
  };

  const chartData = data?.tasks?.slice(0, 15).map((t: any) => ({
    name: t.taskTitle.length > 14 ? t.taskTitle.slice(0, 14) + '…' : t.taskTitle,
    Planned: t.plannedHours,
    Actual: t.actualHours,
  })) ?? [];

  return (
    <ReportCard icon={<BarChart2 size={18} />} title="Planned vs Actual" description="Task-level effort comparison for a selected project.">
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-1 w-full max-w-xs">
          <label className="text-xs font-bold text-muted-foreground">Project</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.projectCode ? `[${p.projectCode}] ` : ''}{p.name}</option>
            ))}
          </select>
        </div>
        <RunExportBar onRun={run} onExport={exportExcel} loading={loading} exporting={exporting} />

        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Planned', value: `${data.summary.totalPlannedHours}h` },
                { label: 'Total Actual', value: `${data.summary.totalActualHours}h` },
                { label: 'Overall Variance', value: `${data.summary.overallVariancePct > 0 ? '+' : ''}${data.summary.overallVariancePct}%`, bad: data.summary.overallVariancePct > 10 },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-2xl p-4 text-center">
                  <p className={cn('text-xl font-black', s.bad ? 'text-red-600' : 'text-primary')}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {chartData.length > 0 && (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="Planned" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Actual" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    {['Task', 'Planned h', 'Actual h', 'Variance h', 'Variance %', 'Planned End', 'Actual End', 'Delay'].map(h => (
                      <th key={h} className="px-3 py-3 font-bold text-muted-foreground text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.tasks.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="px-3 py-3 font-medium max-w-[200px] truncate">{t.taskTitle}</td>
                      <td className="px-3 py-3">{t.plannedHours}</td>
                      <td className="px-3 py-3">{t.actualHours}</td>
                      <td className={cn('px-3 py-3 font-bold', t.variance > 0 ? 'text-red-600' : 'text-green-600')}>
                        {t.variance > 0 ? '+' : ''}{t.variance}
                      </td>
                      <td className={cn('px-3 py-3', t.variancePct > 0 ? 'text-red-600' : 'text-green-600')}>
                        {t.variancePct > 0 ? '+' : ''}{t.variancePct}%
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{t.plannedEnd ?? '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{t.actualEnd ?? '—'}</td>
                      <td className="px-3 py-3">
                        {t.delayDays > 0 ? (
                          <span className="text-red-600 font-bold">{t.delayDays}d</span>
                        ) : <span className="text-green-600">On time</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ReportCard>
  );
}

// ─── 6. Milestone Delays ─────────────────────────────────────────────────────

function MilestoneDelaysReport() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/milestone-delays');
      setData(res.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcel('/reports/milestone-delays', {}, 'milestone-delays.xlsx'); }
    finally { setExporting(false); }
  };

  return (
    <ReportCard icon={<Milestone size={18} />} title="Milestone Delays" description="All milestones past their due date that haven't been achieved.">
      <div className="p-6 space-y-4">
        <RunExportBar onRun={run} onExport={exportExcel} loading={loading} exporting={exporting} />

        {data && (
          <div className="space-y-4">
            {data.summary.count > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-red-600">{data.summary.count}</p>
                  <p className="text-xs text-muted-foreground mt-1">Delayed Milestones</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-amber-600">₹{(data.summary.totalAtRisk / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-muted-foreground mt-1">Total At Risk</p>
                </div>
              </div>
            )}

            {data.rows.length === 0 ? (
              <EmptyState message="No delayed milestones. All on track!" />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      {['Project', 'Milestone', 'Due Date', 'Delay', 'Amount', 'Status', 'PM'].map(h => (
                        <th key={h} className="px-4 py-3 font-bold text-muted-foreground text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.rows.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-4 py-3">
                          <p className="font-bold">{r.project}</p>
                          <p className="text-xs text-muted-foreground">{r.projectCode}</p>
                        </td>
                        <td className="px-4 py-3 font-medium">{r.milestone}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.dueDate}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'font-black',
                            r.delayDays > 30 ? 'text-red-600' : r.delayDays > 7 ? 'text-amber-600' : 'text-yellow-600'
                          )}>
                            {r.delayDays}d
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">₹{r.amount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-700">{r.status}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.pm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </ReportCard>
  );
}

// ─── 7. Margin by Project ────────────────────────────────────────────────────

function MarginByProjectReport({ financialYears }: { financialYears: { id: string; label: string; isCurrent: boolean }[] }) {
  const defaultFY = financialYears.find(f => f.isCurrent)?.id ?? '';
  const [fyId, setFyId] = useState(defaultFY);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/margin-by-project', { params: { financialYearId: fyId || undefined } });
      setData(res.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcel('/reports/margin-by-project', { financialYearId: fyId || undefined }, 'margin-by-project.xlsx'); }
    finally { setExporting(false); }
  };

  const chartData = data.slice(0, 12).map(p => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
    margin: p.marginPct,
  }));

  return (
    <ReportCard icon={<TrendingDown size={18} />} title="Margin by Project" description="Revenue vs cost breakdown with profitability margin per project.">
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-1 w-full max-w-xs">
          <label className="text-xs font-bold text-muted-foreground">Financial Year</label>
          <select value={fyId} onChange={e => setFyId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">All Time</option>
            {financialYears.map(fy => (
              <option key={fy.id} value={fy.id}>{fy.label}{fy.isCurrent ? ' (Current)' : ''}</option>
            ))}
          </select>
        </div>
        <RunExportBar onRun={run} onExport={exportExcel} loading={loading} exporting={exporting} />

        {data.length > 0 && (
          <div className="space-y-6">
            {chartData.length > 0 && (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip formatter={(v) => `${Number(v ?? 0)}%`} />
                    <ReferenceLine y={0} stroke="#E5E7EB" />
                    <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.margin < 0 ? '#EF4444' : entry.margin < 15 ? '#F59E0B' : '#10B981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    {['Project', 'Client', 'Revenue', 'Employee Cost', 'Freelancer Cost', 'Overhead', 'Total Cost', 'Margin', 'Margin %'].map(h => (
                      <th key={h} className="px-3 py-3 font-bold text-muted-foreground text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="px-3 py-3">
                        <p className="font-bold">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.projectCode}</p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{r.client}</td>
                      <td className="px-3 py-3">₹{r.revenue.toLocaleString()}</td>
                      <td className="px-3 py-3 text-muted-foreground">₹{r.employeeCost.toLocaleString()}</td>
                      <td className="px-3 py-3 text-muted-foreground">₹{r.freelancerCost.toLocaleString()}</td>
                      <td className="px-3 py-3 text-muted-foreground">₹{r.overheadCost.toLocaleString()}</td>
                      <td className="px-3 py-3 font-medium">₹{r.totalCost.toLocaleString()}</td>
                      <td className={cn('px-3 py-3 font-bold', r.margin < 0 ? 'text-red-600' : 'text-green-600')}>
                        ₹{r.margin.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-black',
                          r.marginPct < 0 ? 'bg-red-100 text-red-700' : r.marginPct < 15 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        )}>
                          {r.marginPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ReportCard>
  );
}

// ─── 8. Freelancer Spend ─────────────────────────────────────────────────────

function FreelancerSpendReport({
  vendors,
  freelancers,
}: {
  vendors: { id: string; vendorName: string; vendorCode: string }[];
  freelancers: { id: string; fullName: string; freelancerCode: string }[];
}) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(lastOfMonth);
  const [vendorId, setVendorId] = useState('');
  const [freelancerId, setFreelancerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  const params = {
    startDate,
    endDate,
    vendorId: vendorId || undefined,
    freelancerId: freelancerId || undefined,
  };

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/freelancer-spend', { params });
      setData(res.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcel('/reports/freelancer-spend', params, 'freelancer-spend.xlsx'); }
    finally { setExporting(false); }
  };

  return (
    <ReportCard icon={<UserCheck size={18} />} title="Freelancer Spend" description="Cost and hours breakdown for freelancers with approved timesheets in the selected period.">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          {vendors.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Vendor</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]">
                <option value="">All Vendors</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
              </select>
            </div>
          )}
          {freelancers.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Freelancer</label>
              <select value={freelancerId} onChange={e => setFreelancerId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]">
                <option value="">All Freelancers</option>
                {freelancers.map(f => <option key={f.id} value={f.id}>[{f.freelancerCode}] {f.fullName}</option>)}
              </select>
            </div>
          )}
        </div>
        <RunExportBar onRun={run} onExport={exportExcel} loading={loading} exporting={exporting} />

        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Freelancers', value: data.summary.freelancerCount, icon: <Users size={16} /> },
                { label: 'Total Hours', value: `${data.summary.totalHours}h`, icon: <Clock size={16} /> },
                { label: 'Total Spend', value: `₹${data.summary.totalSpend.toLocaleString()}`, icon: <DollarSign size={16} /> },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">{s.icon}</div>
                  <div>
                    <p className="text-lg font-black">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {data.freelancers.length === 0 ? (
              <EmptyState message="No freelancer timesheets found for this period." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      {['Code', 'Name', 'Vendor', 'Currency', 'Rate/h', 'Total Hours', 'Total Cost', 'Projects'].map(h => (
                        <th key={h} className="px-4 py-3 font-bold text-muted-foreground text-xs whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.freelancers.map((f: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-4 py-3 font-mono text-xs">{f.freelancerCode}</td>
                        <td className="px-4 py-3 font-bold">{f.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{f.vendor || '—'}</td>
                        <td className="px-4 py-3">{f.currency}</td>
                        <td className="px-4 py-3">{f.costPerHour}</td>
                        <td className="px-4 py-3 font-medium">{f.totalHours}h</td>
                        <td className="px-4 py-3 font-bold text-primary">{f.totalCost.toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={f.projectSummary}>{f.projectSummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </ReportCard>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function OperationalReports() {
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; projectCode: string | null }[]>([]);
  const [financialYears, setFinancialYears] = useState<{ id: string; label: string; isCurrent: boolean }[]>([]);
  const [vendors, setVendors] = useState<{ id: string; vendorName: string; vendorCode: string }[]>([]);
  const [freelancers, setFreelancers] = useState<{ id: string; fullName: string; freelancerCode: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/reports/meta/departments'),
      api.get('/reports/meta/projects'),
      api.get('/reports/meta/financial-years'),
      api.get('/reports/meta/vendors'),
      api.get('/reports/meta/freelancers'),
    ]).then(([depts, projs, fys, vends, frees]) => {
      setDepartments(depts.data);
      setProjects(projs.data);
      setFinancialYears(fys.data);
      setVendors(vends.data);
      setFreelancers(frees.data);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <MissingTimesheetsReport departments={departments} />
      <PendingApprovalsReport />
      <OverAllocationReport />
      <LeaveCalendarReport departments={departments} />
      <PlannedVsActualReport projects={projects} />
      <MilestoneDelaysReport />
      <MarginByProjectReport financialYears={financialYears} />
      <FreelancerSpendReport vendors={vendors} freelancers={freelancers} />
      <AvailabilityReport />
    </div>
  );
}
