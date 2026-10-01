'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  AlertTriangle, CheckCircle2, Clock, Calendar, Users, ArrowRight,
  FolderKanban, UserPlus, ClipboardList, Briefcase, FileCheck, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type RagColor = 'GREEN' | 'AMBER' | 'RED';

interface RagStatus {
  schedule: RagColor;
  budget: RagColor;
  resources: RagColor;
  overall: RagColor;
}

interface ProjectRow {
  id: string;
  name: string;
  projectCode?: string;
  rag: RagStatus;
}

function RagDot({ color }: { color: RagColor }) {
  const cls =
    color === 'RED' ? 'bg-red-500' : color === 'AMBER' ? 'bg-amber-400' : 'bg-emerald-500';
  return <span className={`inline-block size-2.5 rounded-full ${cls}`} />;
}

export default function ManagementDashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [hrData, setHrData] = useState<any>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/dashboard/portfolio-kpis'),
      api.get('/dashboard/hr'),
      api.get('/reports/pending-approvals'),
      api.get('/projects?status=ACTIVE'),
    ])
      .then(async ([kpiRes, hrRes, appRes, projRes]) => {
        if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value.data);
        if (hrRes.status === 'fulfilled') setHrData(hrRes.value.data);
        if (appRes.status === 'fulfilled') {
          setPendingApprovals(appRes.value.data?.rows ?? appRes.value.data ?? []);
        }

        if (projRes.status === 'fulfilled') {
          const projects: { id: string; name: string; projectCode?: string }[] =
            projRes.value.data?.data ?? projRes.value.data ?? [];
          const rows = await Promise.all(
            projects.slice(0, 10).map(async (p) => {
              try {
                const ragRes = await api.get(`/dashboard/project/${p.id}/rag`);
                return { id: p.id, name: p.name, projectCode: p.projectCode, rag: ragRes.data as RagStatus };
              } catch {
                return {
                  id: p.id,
                  name: p.name,
                  projectCode: p.projectCode,
                  rag: { schedule: 'GREEN', budget: 'GREEN', resources: 'GREEN', overall: 'GREEN' } as RagStatus,
                };
              }
            }),
          );
          setProjectRows(rows);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Loading Executive Dashboard...
          </p>
        </div>
      </div>
    );
  }

  const atRisk = kpis?.atRiskMilestones ?? 0;
  const pendingLeavesCount = hrData?.pendingLeaves ?? 0;
  const missingTimesheetsCount = kpis?.missingTimesheets ?? 0;
  const totalPendingWorkflow = kpis?.pendingApprovals ?? pendingApprovals.length;
  const activeStaffCount = hrData?.headcount ?? kpis?.totalActiveUsers ?? 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight uppercase">
            Operations &amp; Executive Overview
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Real-time workforce, approvals &amp; project health snapshot — {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/todo">
            <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8">
              <ClipboardList size={13} />
              My Todo
            </Button>
          </Link>
          <Link href="/approvals">
            <Button size="sm" className="text-xs gap-1.5 h-8">
              <FileCheck size={13} />
              Review Approvals
              {totalPendingWorkflow > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                  {totalPendingWorkflow}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* Critical Overdue / At-Risk Alert Banner */}
      {atRisk > 0 && (
        <div className="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-xs font-bold text-red-800 dark:text-red-200">
              <span className="font-black uppercase">{atRisk} milestone{atRisk > 1 ? 's' : ''} overdue</span> — delivery schedule requires immediate intervention.
            </p>
          </div>
          <Link href="/projects/tracker" className="text-xs font-black uppercase text-red-700 hover:underline flex items-center gap-1 shrink-0">
            View Tracker <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Top 4 Operational KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Projects */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Active Projects</p>
              <div className="size-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 flex items-center justify-center">
                <FolderKanban size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{kpis?.totalProjects ?? 0}</p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-3 flex items-center gap-1">
            <span className="text-blue-600 font-bold">{kpis?.projectsByStatus?.ACTIVE ?? 0} active</span>
            <span>· {kpis?.projectsByStatus?.ON_HOLD ?? 0} on hold</span>
          </p>
        </div>

        {/* Workforce & Bench */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Active Workforce</p>
              <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 flex items-center justify-center">
                <Users size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{activeStaffCount}</p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-3">
            <span className="text-amber-600 font-bold">{kpis?.benchPct ?? 0}% bench</span> ({kpis?.benchCount ?? 0} unallocated)
          </p>
        </div>

        {/* Resource Utilization */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Staff Utilization</p>
              <div className="size-8 rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 flex items-center justify-center">
                <Briefcase size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{kpis?.utilizationPct ?? 0}%</p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-3">
            Target utilization: <span className="font-bold text-foreground">80%</span>
          </p>
        </div>

        {/* Action Items Required */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Pending Approvals</p>
              <div className="size-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 flex items-center justify-center">
                <FileCheck size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600 mt-2">{totalPendingWorkflow}</p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-3">
            <span className="text-red-600 font-bold">{missingTimesheetsCount} missing</span> timesheets
          </p>
        </div>
      </div>

      {/* Action Center Grid: Left = Pending Approvals Queue, Right = Quick Shortcuts & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Approvals Hub */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:px-6 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-foreground uppercase tracking-tight">
                Pending Approvals &amp; Action Queue
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Requests requiring manager review and sign-off
              </p>
            </div>
            <Link href="/approvals" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b bg-muted/20">
            <Link
              href="/admin/leaves"
              className="p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors space-y-1 block"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Leave Requests</span>
              <p className="text-xl font-black text-foreground">{pendingLeavesCount}</p>
              <p className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5">
                Manage Leaves <ArrowRight size={10} />
              </p>
            </Link>

            <Link
              href="/approvals"
              className="p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors space-y-1 block"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Timesheet Approvals</span>
              <p className="text-xl font-black text-foreground">{totalPendingWorkflow}</p>
              <p className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5">
                Review Hours <ArrowRight size={10} />
              </p>
            </Link>

            <Link
              href="/reports/missing-timesheets"
              className="p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors space-y-1 block"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Missing Timesheets</span>
              <p className="text-xl font-black text-red-600">{missingTimesheetsCount}</p>
              <p className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5">
                View Defaulters <ArrowRight size={10} />
              </p>
            </Link>
          </div>

          {/* Pending items list */}
          <div className="flex-1 overflow-x-auto">
            {pendingApprovals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-500 opacity-80" />
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-0.5">No approval requests currently pending your attention.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-2.5 font-bold uppercase text-muted-foreground">Module</th>
                    <th className="px-4 py-2.5 font-bold uppercase text-muted-foreground">Requester</th>
                    <th className="px-4 py-2.5 font-bold uppercase text-muted-foreground">Requested At</th>
                    <th className="px-4 py-2.5 font-bold uppercase text-muted-foreground">Pending Age</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingApprovals.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary">
                          {row.module}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.requestedBy}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{row.requestedAt}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${row.ageDays > 3 ? 'text-red-600' : 'text-foreground'}`}>
                          {row.ageDays} day{row.ageDays === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href="/approvals">
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5 text-primary">
                            Review
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Operations & Resource Links */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Quick Shortcuts</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Common administrative actions</p>

            <div className="mt-4 space-y-2">
              <Link
                href="/todo"
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardList size={16} className="text-primary" />
                  <span className="text-xs font-semibold text-foreground">Task &amp; Todo Manager</span>
                </div>
                <ArrowRight size={13} className="text-muted-foreground" />
              </Link>

              <Link
                href="/users"
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <UserPlus size={16} className="text-emerald-600" />
                  <span className="text-xs font-semibold text-foreground">User Master &amp; Staff</span>
                </div>
                <ArrowRight size={13} className="text-muted-foreground" />
              </Link>

              <Link
                href="/reports/leave"
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar size={16} className="text-amber-600" />
                  <span className="text-xs font-semibold text-foreground">Monthly Leave Report</span>
                </div>
                <ArrowRight size={13} className="text-muted-foreground" />
              </Link>

              <Link
                href="/resource-planning"
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Layers size={16} className="text-violet-600" />
                  <span className="text-xs font-semibold text-foreground">Resource Allocation Matrix</span>
                </div>
                <ArrowRight size={13} className="text-muted-foreground" />
              </Link>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/40 border text-xs text-muted-foreground space-y-1">
            <p className="font-bold text-foreground">Tip: Weekly Timesheet Cut-off</p>
            <p className="text-[11px]">
              Remind team leads to approve submitted timesheets before Friday end-of-day for payroll sync.
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio RAG Status Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Active Projects Health (RAG Matrix)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Schedule, Budget, and Resource health per active project</p>
          </div>
          <Link href="/projects" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            All Projects <ArrowRight size={12} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {['Project Name', 'Schedule', 'Budget', 'Resources', 'Overall Status', 'Action'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {projectRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground font-black uppercase tracking-widest">
                    No active projects currently tracked
                  </td>
                </tr>
              )}
              {projectRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-foreground">{row.name}</p>
                    {row.projectCode && <p className="text-[11px] text-muted-foreground font-mono">{row.projectCode}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <RagDot color={row.rag.schedule} />
                      <span className="font-medium capitalize">{row.rag.schedule.toLowerCase()}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <RagDot color={row.rag.budget} />
                      <span className="font-medium capitalize">{row.rag.budget.toLowerCase()}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <RagDot color={row.rag.resources} />
                      <span className="font-medium capitalize">{row.rag.resources.toLowerCase()}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase ${
                        row.rag.overall === 'RED'
                          ? 'border-red-400 text-red-700 bg-red-50 dark:bg-red-950/40'
                          : row.rag.overall === 'AMBER'
                            ? 'border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40'
                            : 'border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40'
                      }`}
                    >
                      {row.rag.overall}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link href={`/projects/${row.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-primary">
                        Details
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
