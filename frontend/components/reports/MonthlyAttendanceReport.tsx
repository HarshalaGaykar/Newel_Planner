'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  reportsApi,
  AttendanceDepartment,
  MonthlyAttendanceFilters,
  MonthlyAttendanceRow,
  MonthlyAttendanceMeta,
} from '@/lib/reports-api';
import {
  Calendar, Building2, Download, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight, UserCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ReportFilterBar } from './ReportFilterBar';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Matches the pattern already duplicated across the frontend (e.g.
// timesheets/[id]/page.tsx, BulkUploadTimesheetDialog.tsx) — no shared util
// exists for it. Sent so the backend resolves "which day" a check-in
// belongs to using the viewer's own calendar, not an assumed default.
function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// Current month/year, no department/name/status filter — the report's
// baseline, used both for the initial load and for what "Clear" resets back
// to (mirrors AttendanceReport.tsx's convention: Clear returns to "now", not
// to an empty/blank date).
function getDefaultFilters(): MonthlyAttendanceFilters {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    departmentId: '',
    userName: '',
    isActive: '',
    timeZone: getBrowserTimeZone(),
  };
}

const PAGE_SIZE = 25;

export default function MonthlyAttendanceReport() {
  const [rows, setRows] = useState<MonthlyAttendanceRow[]>([]);
  const [meta, setMeta] = useState<MonthlyAttendanceMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [departments, setDepartments] = useState<AttendanceDepartment[]>([]);

  // `filters` is the applied/committed set the report is actually fetched
  // with; `draftFilters` is what the inputs are bound to — editing a field
  // doesn't fetch until Apply (or Clear) is clicked.
  const [filters, setFilters] = useState<MonthlyAttendanceFilters>(getDefaultFilters());
  const [draftFilters, setDraftFilters] = useState<MonthlyAttendanceFilters>(getDefaultFilters());
  const [page, setPage] = useState(1);

  const updateDraftFilter = (patch: Partial<MonthlyAttendanceFilters>) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleApplyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
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

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getMonthlyAttendanceReport(filters, page, PAGE_SIZE);
      setRows(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      setRows([]);
      setMeta(null);
      setError(
        err.response?.data?.message
          ? Array.isArray(err.response.data.message) ? err.response.data.message.join(', ') : err.response.data.message
          : 'Failed to load the monthly attendance report. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    window.open(reportsApi.getMonthlyAttendanceExportUrl(filters), '_blank');
  };

  const rangeLabel = useMemo(() => {
    if (!meta || meta.total === 0) return '0 of 0';
    const from = (meta.page - 1) * meta.limit + 1;
    const to = Math.min(meta.page * meta.limit, meta.total);
    return `${from}–${to} of ${meta.total}`;
  }, [meta]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-md/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Monthly Attendance Report</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Daily check-in register — every employee, every day of the month
            </p>
          </div>
          <Button onClick={handleExport} className="gap-2 text-xs font-black uppercase tracking-widest rounded-xl">
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </Button>
        </div>

        <ReportFilterBar onApply={handleApplyFilters} onClear={handleClearFilters} loading={loading} columns={3}>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Month</label>
            <Select value={draftFilters.month} onValueChange={(v) => updateDraftFilter({ month: v })}>
              <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Year</label>
            <Input
              type="number"
              value={draftFilters.year}
              onChange={(e) => updateDraftFilter({ year: e.target.value })}
              className="h-10 text-xs font-bold rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Department</label>
            <Select
              value={draftFilters.departmentId || 'all'}
              onValueChange={(v) => updateDraftFilter({ departmentId: v === 'all' ? '' : v })}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Employee Name Contains</label>
            <Input
              value={draftFilters.userName}
              onChange={(e) => updateDraftFilter({ userName: e.target.value })}
              placeholder="e.g. Sharma"
              className="h-10 text-xs font-bold rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Employee Status</label>
            <Select
              value={draftFilters.isActive || 'all'}
              onValueChange={(v) => updateDraftFilter({ isActive: v === 'all' ? '' : (v as 'true' | 'false') })}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                <SelectItem value="true">Active Only</SelectItem>
                <SelectItem value="false">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ReportFilterBar>
      </div>

      {/* Report Table */}
      <div className="bg-card rounded-xl border border-border shadow-lg/30 overflow-hidden">
        {error ? (
          <div className="p-16 text-center flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-xs font-bold text-muted-foreground max-w-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchReport} className="gap-2 text-xs font-black uppercase tracking-widest">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Employee</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Date</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Day</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest text-right">Check-In Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.username}-${row.date}-${i}`}>
                  <TableCell>
                    <div className="text-xs font-black text-foreground flex items-center gap-2">
                      <UserCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                      {row.employeeName || '—'}
                    </div>
                    <div className="text-xs font-bold text-muted-foreground mt-0.5">{row.username}</div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-black uppercase tracking-widest ${
                        row.userStatus === 'Active' ? 'text-green-600' : 'text-muted-foreground'
                      }`}
                    >
                      {row.userStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-black text-foreground">
                    {new Date(row.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-muted-foreground uppercase">{row.dayOfWeek}</TableCell>
                  <TableCell className="text-right">
                    {row.checkInTime ? (
                      <span className="text-xs font-black text-foreground">
                        {new Date(row.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-destructive uppercase tracking-widest">Absent</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-20 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                    No attendance records found for the selected criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* Pagination footer */}
        {!error && !loading && meta && meta.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Showing {rangeLabel}
            </p>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs font-black uppercase tracking-widest"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-xs font-black text-foreground uppercase tracking-widest">
                    Page {meta.page} of {meta.totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs font-black uppercase tracking-widest"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
}
