'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { usersApi } from '@/lib/users-api';
import {
  reportsApi,
  TimesheetReportEntry,
  TimesheetReportFilters,
  TimesheetReportMeta,
} from '@/lib/reports-api';
import {
  Calendar, Download, Clock, FileText, Filter,
  ChevronLeft, ChevronRight, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ReportFilterBar } from './ReportFilterBar';

type TimesheetEntryRow = TimesheetReportEntry;
type ReportMeta = TimesheetReportMeta;

// Last-30-days-to-today — the report's baseline window, used both for the
// initial load and for what "Clear" resets back to.
function getDefaultFilters(): TimesheetReportFilters {
  return {
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    projectId: '',
    userId: '',
  };
}

interface TimesheetReportProps {
  // Pre-seeds the filter bar — used when this report is opened in context
  // (e.g. drilling in from a Utilization Report row) instead of standalone.
  initialFilters?: Partial<{ startDate: string; endDate: string; projectId: string; userId: string }>;
}

const PAGE_SIZE = 25;

export default function TimesheetReport({ initialFilters }: TimesheetReportProps = {}) {
  const [entries, setEntries] = useState<TimesheetEntryRow[]>([]);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [projects, setProjects] = useState<SearchableSelectOption[]>([]);
  const [users, setUsers] = useState<SearchableSelectOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  // `filters` is the applied/committed set the report is actually fetched
  // with; `draftFilters` is what the inputs are bound to. They only merge on
  // Apply (or Clear) — editing an input no longer fetches on every change.
  const [filters, setFilters] = useState<TimesheetReportFilters>({ ...getDefaultFilters(), ...initialFilters });
  const [draftFilters, setDraftFilters] = useState<TimesheetReportFilters>({ ...getDefaultFilters(), ...initialFilters });
  const [page, setPage] = useState(1);

  const updateDraftFilter = (patch: Partial<TimesheetReportFilters>) => {
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
    setOptionsLoading(true);
    Promise.all([
      api.get('/projects'),
      // Unscoped by reporting hierarchy — unlike /users/team-members, this
      // resolves any active user regardless of who's viewing the report, which
      // matters when the report is opened for someone outside the viewer's team.
      usersApi.getAllocatable(),
    ])
      .then(([projRes, allUsers]) => {
        setProjects(projRes.data.map((p: any) => ({ value: p.id, label: p.name })));
        setUsers(
          allUsers.map((u) => ({
            value: u.id,
            label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
            sublabel: u.email,
          })),
        );
      })
      .catch((err) => console.error('Error fetching filter options:', err))
      .finally(() => setOptionsLoading(false));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getTimesheetReportPaginated(filters, page, PAGE_SIZE);
      setEntries(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      setEntries([]);
      setMeta(null);
      setError(
        err.response?.data?.message
          ? Array.isArray(err.response.data.message) ? err.response.data.message.join(', ') : err.response.data.message
          : 'Failed to load the timesheet report. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    window.open(reportsApi.getTimesheetExportUrl(filters), '_blank');
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
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Timesheet Intelligence</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Granular workforce effort analysis</p>
          </div>
          <Button onClick={handleExport} className="gap-2 text-xs font-black uppercase tracking-widest rounded-xl">
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </Button>
        </div>

        <ReportFilterBar onApply={handleApplyFilters} onClear={handleClearFilters} loading={loading}>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={draftFilters.startDate}
                onChange={(e) => updateDraftFilter({ startDate: e.target.value })}
                className="pl-9 h-10 text-xs font-bold rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={draftFilters.endDate}
                min={draftFilters.startDate}
                onChange={(e) => updateDraftFilter({ endDate: e.target.value })}
                className="pl-9 h-10 text-xs font-bold rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Project</label>
            <SearchableSelect
              options={projects}
              value={draftFilters.projectId}
              onValueChange={(v) => updateDraftFilter({ projectId: v })}
              allLabel="All Projects"
              searchPlaceholder="Search projects..."
              loading={optionsLoading}
              className="h-10 rounded-xl text-xs font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Resource</label>
            <SearchableSelect
              options={users}
              value={draftFilters.userId}
              onValueChange={(v) => updateDraftFilter({ userId: v })}
              allLabel="All Users"
              searchPlaceholder="Search resources..."
              loading={optionsLoading}
              className="h-10 rounded-xl text-xs font-bold"
            />
          </div>
        </ReportFilterBar>
      </div>

      {/* Summary Cards — reflect the full filtered set, not just the current page */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-primary p-6 rounded-xl text-primary-foreground shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-primary-foreground/70 uppercase tracking-[0.2em] mb-1">Total Logged Effort</p>
            <h3 className="text-2xl font-black">{(meta?.totalHours ?? 0).toFixed(1)} <span className="text-sm font-bold text-primary-foreground/70">HRS</span></h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-card/10 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Entry Count</p>
            <h3 className="text-2xl font-black text-foreground">{meta?.total ?? 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Average / Entry</p>
            <h3 className="text-2xl font-black text-foreground">
              {((meta?.totalHours ?? 0) / (meta?.total || 1)).toFixed(1)} <span className="text-sm font-bold text-muted-foreground">HRS</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <Filter className="w-6 h-6" />
          </div>
        </div>
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
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Date</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Project</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Resource</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Role</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Maturity</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Activity/Task</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest text-right">Effort</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="text-xs font-black text-foreground">{new Date(entry.date).toLocaleDateString()}</div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter mt-0.5">{new Date(entry.date).toLocaleDateString('default', { weekday: 'short' })}</div>
                  </TableCell>
                  <TableCell className="text-xs font-black text-foreground">{entry.project.name}</TableCell>
                  <TableCell>
                    <div className="text-xs font-black text-foreground">{entry.timesheet.user?.email?.split('@')[0] ?? '—'}</div>
                    <div className="text-xs font-bold text-muted-foreground uppercase mt-0.5">{entry.timesheet.user?.email ?? '—'}</div>
                  </TableCell>
                  <TableCell className="text-xs font-black text-foreground">{entry.roleName || '—'}</TableCell>
                  <TableCell className="text-xs font-black text-foreground">
                    {entry.maturityValue != null ? Number(entry.maturityValue).toFixed(2) : '—'}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    <div className="text-xs font-black text-foreground truncate">
                      {entry.task?.title || entry.ticket?.title || 'General Activity'}
                    </div>
                    <div className="text-xs text-muted-foreground italic line-clamp-1 mt-0.5">{entry.description || 'No description provided'}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-xs font-black text-foreground">{entry.hours.toFixed(1)} hrs</div>
                    <div className="h-1.5 w-12 ml-auto mt-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${Math.min((entry.hours / 8) * 100, 100)}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-20 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                    No effort records found for the selected criteria.
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
