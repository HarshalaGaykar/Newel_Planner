'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Users,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Clock,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendPoint {
  month: number;
  year: number;
  label: string;
  utilizationPct: number;
  allocationPct: number;
  totalAvailableHrs: number;
  totalAllocatedHrs: number;
  totalBillableHrs: number;
}

interface BenchUser {
  id: string;
  name: string;
  employeeCode: string | null;
  designation: string | null;
  skills: string[];
  benchSince: string;
  benchDays: number;
}

interface ForecastMonth {
  month: number;
  year: number;
  label: string;
  supplyHrs: number;
  demandHrs: number;
  gapHrs: number;
  pipelineDemands: number;
  recommendedHires: number;
  isGap: boolean;
  utilizationPct: number;
}

interface GridMonthSnap {
  utilizationPct: number;
  allocatedHrs: number;
  availableHrs: number;
}

interface GridUser {
  id: string;
  name: string;
  employeeCode: string | null;
  designation: string | null;
  months: GridMonthSnap[];
}

interface GridData {
  months: { month: number; year: number; label: string }[];
  users: GridUser[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function benchColor(days: number): string {
  if (days < 7) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (days < 30) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  if (days < 90) return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function utilizationBg(pct: number): string {
  if (pct >= 80) return 'bg-emerald-100 text-emerald-800';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-800';
  if (pct > 0) return 'bg-orange-100 text-orange-800';
  return 'bg-muted text-muted-foreground';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-xl', color)}>{icon}</div>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ trend }: { trend: TrendPoint[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-sm font-semibold mb-1">Demand vs Supply</h2>
        <p className="text-xs text-muted-foreground mb-4">Hours per month</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => Number(v ?? 0).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="totalAvailableHrs"
              name="Supply"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="totalAllocatedHrs"
              name="Demand"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="totalBillableHrs"
              name="Billable"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-sm font-semibold mb-1">Utilization & Allocation Trend</h2>
        <p className="text-xs text-muted-foreground mb-4">Percentage over last 6 months</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v) => `${Number(v ?? 0)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="utilizationPct"
              name="Utilization %"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="allocationPct"
              name="Allocation %"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 4 }}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Bench Tab ────────────────────────────────────────────────────────────────

function BenchTab({ benchPool }: { benchPool: BenchUser[] }) {
  const agingGroups = [
    { label: '< 7 days', color: 'emerald', count: benchPool.filter(u => u.benchDays < 7).length },
    { label: '7–30 days', color: 'yellow', count: benchPool.filter(u => u.benchDays >= 7 && u.benchDays < 30).length },
    { label: '30–90 days', color: 'orange', count: benchPool.filter(u => u.benchDays >= 30 && u.benchDays < 90).length },
    { label: '> 90 days', color: 'red', count: benchPool.filter(u => u.benchDays >= 90).length },
  ];

  const agingColorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className="space-y-5">
      {/* Aging summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {agingGroups.map(g => (
          <div
            key={g.label}
            className={cn(
              'rounded-xl border p-4 text-center',
              agingColorMap[g.color],
            )}
          >
            <div className="text-2xl font-bold">{g.count}</div>
            <div className="text-xs font-medium mt-1">{g.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">
            Bench Pool — {benchPool.length} employees
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Employees with less than 20% active allocation
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                  Skills
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                  Bench Since
                </th>
                <th className="text-center px-5 py-3 font-medium text-muted-foreground">
                  Bench Days
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {benchPool.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-10 text-muted-foreground text-sm"
                  >
                    No employees currently on bench
                  </td>
                </tr>
              ) : (
                benchPool.map(u => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium">{u.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.designation ?? u.employeeCode ?? ''}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.skills.slice(0, 3).map(s => (
                          <span
                            key={s}
                            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full"
                          >
                            {s}
                          </span>
                        ))}
                        {u.skills.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{u.skills.length - 3}
                          </span>
                        )}
                        {u.skills.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">
                      {fmtDate(u.benchSince)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                          benchColor(u.benchDays),
                        )}
                      >
                        {u.benchDays}d
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Forecast Tab ─────────────────────────────────────────────────────────────

function ForecastTab({ forecast }: { forecast: ForecastMonth[] }) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        {forecast.map(f => (
          <div
            key={`${f.month}-${f.year}`}
            className={cn(
              'rounded-2xl border p-5',
              f.isGap
                ? 'border-red-200 bg-red-50'
                : 'border-emerald-200 bg-emerald-50',
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">{f.label}</h3>
              <span
                className={cn(
                  'text-xs px-2.5 py-0.5 rounded-full font-semibold',
                  f.isGap
                    ? 'bg-red-100 text-red-700'
                    : 'bg-emerald-100 text-emerald-700',
                )}
              >
                {f.isGap ? 'Gap' : 'Covered'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <Row label="Supply" value={`${f.supplyHrs.toLocaleString()} h`} />
              <Row label="Demand" value={`${f.demandHrs.toLocaleString()} h`} />
              <Row label="Utilization" value={`${f.utilizationPct}%`} />
              <div className="flex justify-between border-t border-current/10 pt-2">
                <span className="text-muted-foreground">Gap</span>
                <span
                  className={cn(
                    'font-bold',
                    f.isGap ? 'text-red-600' : 'text-emerald-600',
                  )}
                >
                  {f.isGap ? '−' : '+'}
                  {Math.abs(f.gapHrs).toLocaleString()} h
                </span>
              </div>
              {f.pipelineDemands > 0 && (
                <Row
                  label="Pipeline demands"
                  value={String(f.pipelineDemands)}
                  valueClass="text-amber-600 font-semibold"
                />
              )}
            </div>

            {f.recommendedHires > 0 && (
              <div className="mt-4 pt-3 border-t border-red-200">
                <p className="text-xs font-bold text-red-600">
                  Recommended Hires: +{f.recommendedHires}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {forecast.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm bg-card rounded-2xl border border-border">
          No forecast data available
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', valueClass)}>{value}</span>
    </div>
  );
}

// ─── Grid Tab ─────────────────────────────────────────────────────────────────

function GridTab({ grid, loading }: { grid: GridData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!grid) return null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h2 className="text-sm font-semibold">
          Capacity Grid — {grid.users.length} employees
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Utilization % per user per month · green ≥80% · yellow ≥50% · orange &lt;50%
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground sticky left-0 bg-muted/40 min-w-[180px]">
                Employee
              </th>
              {grid.months.map(m => (
                <th
                  key={`${m.month}-${m.year}`}
                  className="text-center px-3 py-3 font-medium text-muted-foreground min-w-[80px]"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grid.users.length === 0 ? (
              <tr>
                <td
                  colSpan={grid.months.length + 1}
                  className="text-center py-10 text-muted-foreground"
                >
                  No snapshot data yet — run a snapshot first
                </td>
              </tr>
            ) : (
              grid.users.map(u => (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 sticky left-0 bg-card border-r">
                    <div className="font-medium">{u.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.designation ?? u.employeeCode ?? ''}
                    </div>
                  </td>
                  {u.months.map((snap, i) => (
                    <td key={i} className="text-center px-3 py-3">
                      <span
                        className={cn(
                          'px-2 py-1 rounded-md text-xs font-semibold',
                          utilizationBg(snap.utilizationPct),
                        )}
                      >
                        {snap.utilizationPct > 0
                          ? `${Math.round(snap.utilizationPct)}%`
                          : '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'bench' | 'forecast' | 'grid';

export default function ResourcePlanningPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [benchPool, setBenchPool] = useState<BenchUser[]>([]);
  const [forecast, setForecast] = useState<ForecastMonth[]>([]);
  const [grid, setGrid] = useState<GridData | null>(null);
  const [gridLoading, setGridLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [trendRes, benchRes, forecastRes] = await Promise.all([
        api.get('/capacity/utilization-trend?months=6'),
        api.get('/capacity/bench-pool'),
        api.get('/capacity/hiring-forecast?months=3'),
      ]);
      setTrend(trendRes.data);
      setBenchPool(benchRes.data);
      setForecast(forecastRes.data);
    } catch (err) {
      console.error('Capacity load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGrid = useCallback(async () => {
    setGridLoading(true);
    try {
      const res = await api.get('/capacity/grid?months=6');
      setGrid(res.data);
    } catch (err) {
      console.error('Grid load error:', err);
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab === 'grid' && !grid) loadGrid();
  }, [activeTab, grid, loadGrid]);

  const latestTrend = trend[trend.length - 1];
  const totalBench = benchPool.length;
  const criticalBench = benchPool.filter(u => u.benchDays > 90).length;
  const hiringNeeded = forecast.reduce((s, f) => s + f.recommendedHires, 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'bench', label: `Bench Pool (${totalBench})` },
    { id: 'forecast', label: 'Hiring Forecast' },
    { id: 'grid', label: 'Capacity Grid' },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-tight uppercase">
            Capacity Planning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demand vs supply · bench aging · hiring forecast
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm px-3 py-2 border rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Utilization"
          value={`${latestTrend?.utilizationPct ?? 0}%`}
          subtitle="Last month billable rate"
          icon={<TrendingUp className="h-4 w-4" />}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title="Allocation Rate"
          value={`${latestTrend?.allocationPct ?? 0}%`}
          subtitle="Capacity currently allocated"
          icon={<Calendar className="h-4 w-4" />}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          title="On Bench"
          value={totalBench}
          subtitle="Employees &lt;20% allocated"
          icon={<Users className="h-4 w-4" />}
          color="bg-orange-50 text-orange-600"
        />
        <StatCard
          title="Critical Bench"
          value={criticalBench}
          subtitle=">90 days without allocation"
          icon={<AlertTriangle className="h-4 w-4" />}
          color="bg-red-50 text-red-600"
        />
      </div>

      {/* Hiring banner */}
      {hiringNeeded > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-amber-800">
            Forecast suggests hiring <strong>{hiringNeeded} FTE(s)</strong> over the next 3
            months to meet projected demand.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab trend={trend} />}
      {activeTab === 'bench' && <BenchTab benchPool={benchPool} />}
      {activeTab === 'forecast' && <ForecastTab forecast={forecast} />}
      {activeTab === 'grid' && (
        <GridTab grid={grid} loading={gridLoading} />
      )}
    </div>
  );
}
