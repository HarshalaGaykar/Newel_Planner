'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Calendar, Download, Briefcase, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ReportFilterBar } from './ReportFilterBar';
import { reportsApi, MonthlyEffortsFilters, MonthlyEffortRow, MonthlyEffortsMeta } from '@/lib/reports-api';

// Defaults to the end of the current month — mirrors the backend's own
// fallback when `asOfDate` is omitted, so the input starts in sync with what
// an empty filter would already return.
function getDefaultFilters(): MonthlyEffortsFilters {
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { asOfDate: monthEnd.toISOString().split('T')[0] };
}

const PAGE_SIZE = 25;

export default function MonthlyEffortsReport() {
  const [rows, setRows] = useState<MonthlyEffortRow[]>([]);
  const [meta, setMeta] = useState<MonthlyEffortsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState<MonthlyEffortsFilters>(getDefaultFilters());
  const [draftFilters, setDraftFilters] = useState<MonthlyEffortsFilters>(getDefaultFilters());
  const [page, setPage] = useState(1);

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

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getMonthlyEffortsReport(filters, page, PAGE_SIZE);
      setRows(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      setRows([]);
      setMeta(null);
      setError(
        err.response?.data?.message
          ? Array.isArray(err.response.data.message) ? err.response.data.message.join(', ') : err.response.data.message
          : 'Failed to load the monthly efforts logged report. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    window.open(reportsApi.getMonthlyEffortsExportUrl(filters), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-md/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Monthly Efforts Logged</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Total hours per project, cumulative up to the selected date
            </p>
          </div>
          <Button onClick={handleExport} className="gap-2 text-xs font-black uppercase tracking-widest rounded-xl">
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </Button>
        </div>

        <ReportFilterBar onApply={handleApplyFilters} onClear={handleClearFilters} loading={loading} columns={2}>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">As Of Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={draftFilters.asOfDate}
                onChange={(e) => setDraftFilters({ asOfDate: e.target.value })}
                className="pl-9 h-10 text-xs font-bold rounded-xl"
              />
            </div>
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
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest">Project</TableHead>
                <TableHead className="text-xs font-black text-muted-foreground uppercase tracking-widest text-right">Total Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.projectName ?? 'unassigned'}-${i}`}>
                  <TableCell>
                    <div className="text-xs font-black text-foreground flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                      {row.projectName || 'Unassigned'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-xs font-black text-foreground">
                      {row.totalHours}h {row.totalMinutes}m
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="p-20 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                    No effort logged as of the selected date.
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
              {meta.total} project{meta.total === 1 ? '' : 's'}
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
