'use client';

import { useState, useEffect } from 'react';
import {
  reportsApi,
  AttendanceDepartment,
  NonComplianceQuery,
  NonComplianceResponse,
} from '@/lib/reports-api';
import { Download, AlertTriangle, FileText, CalendarDays } from 'lucide-react';
import { ReportFilterBar } from './ReportFilterBar';

function getDefaultFilters(): NonComplianceQuery {
  return { 
    startDate: '', 
    endDate: '', 
    departmentId: '', 
    userName: '', 
    includeWeekends: '', 
    includeHolidays: '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

export default function NonComplianceReport() {
  const [departments, setDepartments] = useState<AttendanceDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NonComplianceResponse | null>(null);
  
  const [page, setPage] = useState(1);
  const limit = 25;

  const [filters, setFilters] = useState<NonComplianceQuery>(getDefaultFilters());
  const [draftFilters, setDraftFilters] = useState<NonComplianceQuery>(getDefaultFilters());

  const updateDraftFilter = (patch: Partial<NonComplianceQuery>) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleApplyFilters = () => {
    setPage(1);
    setFilters(draftFilters);
  };

  const handleClearFilters = () => {
    const defaults = getDefaultFilters();
    setDraftFilters(defaults);
    setFilters(defaults);
    setPage(1);
  };

  useEffect(() => {
    reportsApi.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    reportsApi.getNonComplianceReport(filters, page, limit)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [filters, page]);

  const handleExport = () => {
    // If startDate/endDate is empty, the backend limits to the last 93 days based on current logic, 
    // or exports the requested range if provided.
    window.open(reportsApi.getNonComplianceExportUrl(filters), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border/50 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Defaulters</span>
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{data?.meta.total || 0}</span>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Missing Records</span>
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="h-4 w-4 text-orange-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
             <span className="text-4xl font-bold">{data?.meta.total || 0}</span>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Page</span>
            <div className="p-2 bg-blue-100 rounded-lg">
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{data?.meta.page || 1}</span>
            <span className="text-muted-foreground font-medium">/ {data?.meta.totalPages || 1}</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <ReportFilterBar
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            loading={loading}
            columns={4}
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={draftFilters.startDate}
                onChange={(e) => updateDraftFilter({ startDate: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={draftFilters.endDate}
                onChange={(e) => updateDraftFilter({ endDate: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</label>
              <select
                value={draftFilters.departmentId}
                onChange={(e) => updateDraftFilter({ departmentId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Name/Code</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={draftFilters.userName}
                onChange={(e) => updateDraftFilter({ userName: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Include Weekends</label>
              <select
                value={draftFilters.includeWeekends}
                onChange={(e) => updateDraftFilter({ includeWeekends: e.target.value as any })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">No (Default)</option>
                <option value="true">Yes</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Include Holidays</label>
              <select
                value={draftFilters.includeHolidays}
                onChange={(e) => updateDraftFilter({ includeHolidays: e.target.value as any })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">No (Default)</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </ReportFilterBar>
        </div>

        <div className="px-4 py-3 flex items-center justify-between bg-muted/10 border-b border-border/50">
          <div className="text-sm text-muted-foreground">
            Showing non-compliant records
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Download size={16} />
            <span>EXPORT EXCEL</span>
          </button>
        </div>

        <div className="overflow-x-auto min-h-[400px] relative">
          {loading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-4 py-3 font-semibold tracking-wider">Date / Day</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Employee</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Department</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Reporting Manager</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Shift Start</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {!data?.data?.length && !loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No non-compliant records found for the selected filters.
                  </td>
                </tr>
              ) : (
                data?.data?.map((row, idx) => (
                  <tr key={`${row.employeeCode}-${row.date}-${idx}`} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{row.date}</div>
                      <div className="text-xs text-muted-foreground uppercase">{row.dayOfWeek}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{row.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Code: {row.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{row.department}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{row.manager || '—'}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{row.shiftStartTime || '—'}</td>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20">
                        Missing Logs
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {data && data.meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between bg-muted/10">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Showing {data.data.length} records
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-xs font-medium text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &lt; PREV
              </button>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Page {page} of {data.meta.totalPages}
              </div>
              <button
                onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
                disabled={page >= data.meta.totalPages}
                className="px-3 py-1 text-xs font-medium text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                NEXT &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
