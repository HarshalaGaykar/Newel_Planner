'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Users, Loader2, Calendar, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProjectSlice {
  projectId: string;
  projectName: string;
  hrs: number;   // internal basis for the % — not displayed
  pct: number;
}
interface ResourceRow {
  userId: string;
  name: string;
  role: string;
  department: string;
  capacityHrs: number;
  allocatedHrs: number;
  freeHrs: number;
  utilizationPct: number;
  overAllocated: boolean;
  projects: ProjectSlice[];
}
interface DashboardResponse {
  month: number;
  year: number;
  resources: ResourceRow[];
  warnings: { tasksMissingDates: number; tasksMissingEffort: number };
}

// Fixed palette — consistent colour per project across every bar and row.
const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthValue: string) {
  const [y, m] = monthValue.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

// Project-segmented % bar (different colour per project), scaled so an
// over-allocated resource never overflows the track. Label = total %.
function CapacityBar({ row, colorFor }: { row: ResourceRow; colorFor: (id: string) => string }) {
  const sumPct = row.projects.reduce((s, p) => s + p.pct, 0);
  const scale = sumPct > 100 ? 100 / sumPct : 1;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden flex">
        {row.projects.map(p => (
          <div
            key={p.projectId}
            title={`${p.projectName} — ${p.pct}%`}
            style={{ width: `${p.pct * scale}%`, backgroundColor: colorFor(p.projectId) }}
            className="h-full transition-all duration-500"
          />
        ))}
      </div>
      <span className={cn('text-xs w-8 text-right', row.overAllocated ? 'text-rose-600 font-medium' : 'text-muted-foreground')}>
        {row.utilizationPct}%
      </span>
    </div>
  );
}

/** Download allocation data as a CSV file */
function exportCsv(
  allocationRows: { resource: string; role: string; project: string; pct: number; over: boolean }[],
  resources: ResourceRow[],
  monthValue: string,
) {
  const label = monthLabel(monthValue);

  const allocLines = [
    ['Resource', 'Role', 'Project', 'Allocation %', 'Over-allocated'],
    ...allocationRows.map(a => [
      a.resource,
      a.role || 'Resource',
      a.project,
      String(a.pct),
      a.over ? 'Yes' : 'No',
    ]),
  ];

  const capLines = [
    [],
    ['Employee Capacity Summary', label],
    ['Name', 'Role', 'Capacity Hrs', 'Allocated Hrs', 'Free Hrs', 'Utilization %', 'Over-allocated'],
    ...resources.map(r => [
      r.name,
      r.role || 'Resource',
      String(r.capacityHrs),
      String(r.allocatedHrs),
      String(r.freeHrs),
      String(r.utilizationPct),
      r.overAllocated ? 'Yes' : 'No',
    ]),
  ];

  const allLines = [
    `Resource Allocation Export — ${label}`,
    '',
    ...allocLines.map(row => row.join(',')),
    ...capLines.map(row => row.join(',')),
  ];
  const csv = allLines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resource-allocation-${monthValue}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResourceAllocationDashboard() {
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState('');

  const [year, month] = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number);
    return [y, m] as const;
  }, [monthValue]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DashboardResponse>('/capacity/allocation-dashboard', {
        params: { month, year },
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load allocation dashboard', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const allResources = data?.resources ?? [];

  // Apply employee name filter client-side.
  const resources = useMemo(() => {
    const q = employeeFilter.trim().toLowerCase();
    if (!q) return allResources;
    return allResources.filter(r => r.name.toLowerCase().includes(q));
  }, [allResources, employeeFilter]);

  // Stable colour per project across the whole page.
  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    allResources.forEach(r =>
      r.projects.forEach(p => {
        if (!map.has(p.projectId)) map.set(p.projectId, PALETTE[i++ % PALETTE.length]);
      }),
    );
    return (id: string) => map.get(id) ?? '#94a3b8';
  }, [allResources]);

  // Flat list of (resource → project → %) allocation rows — respects employee filter.
  const allocationRows = useMemo(
    () =>
      resources.flatMap(r =>
        r.projects.map(p => ({
          key: `${r.userId}:${p.projectId}`,
          resource: r.name,
          role: r.role,
          projectId: p.projectId,
          project: p.projectName,
          pct: p.pct,
          over: r.overAllocated,
        })),
      ),
    [resources],
  );

  // Stats always reflect the full unfiltered dataset.
  const stats = useMemo(() => ({
    total: allResources.length,
    activeProjects: new Set(allResources.flatMap(r => r.projects.map(p => p.projectId))).size,
    totalAllocations: allResources.flatMap(r => r.projects).length,
    over: allResources.filter(r => r.overAllocated).length,
  }), [allResources]);

  const warnings = data?.warnings;
  const hasWarnings = warnings && (warnings.tasksMissingDates > 0 || warnings.tasksMissingEffort > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-base font-semibold">Resource Allocation</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Allocation % auto-calculated from planned task effort.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Employee filter — comes before month picker per design */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded px-2 py-1.5">
            <Users size={13} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Filter employee…"
              value={employeeFilter}
              onChange={e => setEmployeeFilter(e.target.value)}
              className="bg-transparent text-xs outline-none w-36 placeholder:text-muted-foreground"
            />
            {employeeFilter && (
              <button
                onClick={() => setEmployeeFilter('')}
                className="text-muted-foreground hover:text-foreground transition-colors text-xs leading-none"
                aria-label="Clear filter"
              >
                ✕
              </button>
            )}
          </div>

          {/* Month picker */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded px-2 py-1.5">
            <Calendar size={13} className="text-muted-foreground" />
            <input
              type="month"
              value={monthValue}
              onChange={e => setMonthValue(e.target.value || currentMonthValue())}
              className="bg-transparent text-xs outline-none cursor-pointer"
            />
          </div>

          {/* Export CSV */}
          <button
            onClick={() => exportCsv(allocationRows, resources, monthValue)}
            disabled={loading || allResources.length === 0}
            className="flex items-center gap-1.5 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export visible data to CSV"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <p>
            Percentages exclude tasks without planned effort or dates.
            {warnings!.tasksMissingEffort > 0 && ` ${warnings!.tasksMissingEffort} task(s) missing effort.`}
            {warnings!.tasksMissingDates > 0 && ` ${warnings!.tasksMissingDates} task(s) missing dates.`}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-primary/50" />
        </div>
      ) : (
        <>
          {/* Summary cards — always reflect full unfiltered dataset */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Resources', value: stats.total, color: 'text-foreground' },
              { label: 'Active Projects', value: stats.activeProjects, color: 'text-foreground' },
              { label: 'Total Allocations', value: stats.totalAllocations, color: 'text-primary' },
              { label: 'Over-allocated', value: stats.over, color: 'text-rose-600' },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-3 shadow-sm">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn('text-lg font-semibold mt-0.5', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Team Capacity — project-wise % bars */}
            <div className="lg:col-span-4 bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col">
              <div className="px-3 py-2.5 border-b flex items-center justify-between">
                <h2 className="text-xs font-semibold flex items-center gap-1.5">
                  <Users size={13} /> Team Capacity
                </h2>
                <span className="text-xs text-muted-foreground">
                  {resources.length}{employeeFilter ? ` of ${allResources.length}` : ''} resources
                </span>
              </div>
              <div className="p-3 space-y-3 max-h-[560px] overflow-auto">
                {resources.map(r => (
                  <div key={r.userId}>
                    <div className="flex justify-between items-end mb-1">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.role || 'Resource'}</p>
                      </div>
                      {r.utilizationPct === 0 && (
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Free</span>
                      )}
                    </div>
                    <CapacityBar row={r} colorFor={colorFor} />
                  </div>
                ))}
                {resources.length === 0 && (
                  <div className="flex flex-col items-center py-12 opacity-40">
                    <Users size={20} className="text-muted-foreground mb-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {employeeFilter ? 'No matching employees' : 'No resources found'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Allocation list — percentages */}
            <div className="lg:col-span-8">
              <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                <div className="px-3 py-2.5 border-b flex items-center justify-between gap-3">
                  <h2 className="text-xs font-semibold flex items-center gap-1.5">
                    <Calendar size={13} /> Allocations
                    {employeeFilter && (
                      <span className="ml-1 text-muted-foreground font-normal">— filtered</span>
                    )}
                  </h2>
                </div>
                <div className="divide-y divide-border/40 max-h-[560px] overflow-auto">
                  {allocationRows.map(a => (
                    <div key={a.key} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/20 transition-colors">
                      <div className="w-48 min-w-0">
                        <p className="text-xs font-medium truncate">{a.resource}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.role || 'Resource'}</p>
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorFor(a.projectId) }} />
                        <p className="text-xs text-foreground truncate">{a.project}</p>
                      </div>
                      <div className="w-16 text-right">
                        <p className={cn('text-xs font-semibold', a.over ? 'text-rose-600' : a.pct > 80 ? 'text-amber-600' : 'text-primary')}>
                          {a.pct}%
                        </p>
                      </div>
                    </div>
                  ))}
                  {allocationRows.length === 0 && (
                    <div className="flex flex-col items-center py-12 opacity-40">
                      <Users size={20} className="text-muted-foreground mb-1.5" />
                      <p className="text-xs text-muted-foreground">
                        {employeeFilter ? 'No allocations for matching employees' : 'No allocations this month'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
