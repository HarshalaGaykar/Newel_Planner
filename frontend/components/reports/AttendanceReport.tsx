'use client';

import { useState, useEffect } from 'react';
import {
  reportsApi,
  AttendanceDepartment,
  AttendanceReportFilters,
  AttendanceReportResponse,
} from '@/lib/reports-api';
import { Calendar, Building2, Download, Clock, CalendarDays, AlertTriangle } from 'lucide-react';
import { ReportFilterBar } from './ReportFilterBar';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Current month/year, no department filter — the report's baseline, used
// both for the initial load and for what "Clear" resets back to.
function getDefaultFilters(): AttendanceReportFilters {
  const now = new Date();
  return { month: String(now.getMonth() + 1), year: String(now.getFullYear()), departmentId: '' };
}

export default function AttendanceReport() {
  const [departments, setDepartments] = useState<AttendanceDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AttendanceReportResponse | null>(null);

  // `filters` is the applied/committed set the report is actually fetched
  // with; `draftFilters` is what the inputs are bound to. They only merge on
  // Apply (or Clear) — editing an input no longer fetches on every change.
  const [filters, setFilters] = useState<AttendanceReportFilters>(getDefaultFilters());
  const [draftFilters, setDraftFilters] = useState<AttendanceReportFilters>(getDefaultFilters());

  const updateDraftFilter = (patch: Partial<AttendanceReportFilters>) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleApplyFilters = () => {
    setFilters(draftFilters);
  };

  const handleClearFilters = () => {
    const defaults = getDefaultFilters();
    setDraftFilters(defaults);
    setFilters(defaults);
  };

  useEffect(() => {
    reportsApi.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getAttendanceReport(filters);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [filters]);

  const handleExport = () => {
    window.open(reportsApi.getAttendanceExportUrl(filters), '_blank');
  };

  const totalPresent = data?.dailySummary?.reduce((s, r) => s + r.present, 0) ?? 0;
  const totalLate = data?.dailySummary?.reduce((s, r) => s + r.late, 0) ?? 0;
  const chronicLatecomers = data?.latecomers?.filter((r) => r.totalLateDays > 3).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Attendance Report</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Daily summary · monthly register · latecomer analysis</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition shadow-lg"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
        </div>

        <ReportFilterBar onApply={handleApplyFilters} onClear={handleClearFilters} loading={loading} columns={3}>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Month</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <select value={draftFilters.month} onChange={e => updateDraftFilter({ month: e.target.value })}
                className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-muted border-none rounded-xl focus:ring-2 focus:ring-ring appearance-none transition">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Year</label>
            <input type="number" value={draftFilters.year} onChange={e => updateDraftFilter({ year: e.target.value })}
              className="w-full px-4 py-2 text-xs font-bold bg-muted border-none rounded-xl focus:ring-2 focus:ring-ring transition" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Department</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <select value={draftFilters.departmentId} onChange={e => updateDraftFilter({ departmentId: e.target.value })}
                className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-muted border-none rounded-xl focus:ring-2 focus:ring-ring appearance-none transition">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </ReportFilterBar>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-primary p-6 rounded-xl text-primary-foreground shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-primary-foreground/70 uppercase tracking-[0.2em] mb-1">Present (Month)</p>
            <h3 className="text-2xl font-black">{totalPresent}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-card/10 flex items-center justify-center"><CalendarDays className="w-6 h-6" /></div>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Late Check-ins</p>
            <h3 className="text-2xl font-black text-foreground">{totalLate}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><Clock className="w-6 h-6" /></div>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Chronic Latecomers (&gt;3)</p>
            <h3 className="text-2xl font-black text-foreground">{chronicLatecomers}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
        </div>
      </div>

      {/* Latecomer Analysis */}
      <div className="bg-card rounded-xl border border-border shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Latecomer Analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Daily Summary &amp; Individual Register sheets are included in the Excel export.</p>
        </div>
        {loading ? (
          <div className="p-20 text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {['Employee', 'Department', 'Late Days', 'Avg Late (min)', 'Max Consecutive', 'Regularizations'].map(h => (
                    <th key={h} className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.latecomers?.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/50 transition">
                    <td className="px-6 py-4 text-xs font-black text-foreground">{r.employeeName}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{r.department}</td>
                    <td className="px-6 py-4 text-xs font-black">{r.totalLateDays > 3 ? <span className="text-red-600">{r.totalLateDays}</span> : <span className="text-amber-600">{r.totalLateDays}</span>}</td>
                    <td className="px-6 py-4 text-xs">{r.avgLateByMinutes} min</td>
                    <td className="px-6 py-4 text-xs">{r.maxConsecutiveLateDays}</td>
                    <td className="px-6 py-4 text-xs">{r.regularizationCount}</td>
                  </tr>
                ))}
                {(!data?.latecomers || data.latecomers.length === 0) && (
                  <tr><td colSpan={6} className="p-20 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">No late check-ins for the selected period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
