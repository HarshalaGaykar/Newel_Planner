'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { operationsApi, MissingEntryUser } from '@/lib/operations-api';
import { adminApi } from '@/lib/admin-api';
import { useAuthStore } from '@/lib/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle, Download, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import {
  type ColumnDef, type PaginationState,
  flexRender, getCoreRowModel, getPaginationRowModel, useReactTable,
} from '@tanstack/react-table';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoFirstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function exportCsv(data: MissingEntryUser[]) {
  const rows: string[][] = [['Employee', 'Email', 'Department', 'Missing Date']];
  data.forEach((u) =>
    u.missingDates.forEach((d) => rows.push([u.name, u.email, u.department ?? '', fmtDate(d)])),
  );
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `missing-timesheets-${isoToday()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Date chips cell ───────────────────────────────────────────────────────────

function DateChips({ dates }: { dates: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const SHOW = 5;
  const visible = expanded ? dates : dates.slice(0, SHOW);
  const extra = dates.length - SHOW;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((d) => (
        <span
          key={d}
          className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium"
        >
          {fmtShort(d)}
        </span>
      ))}
      {!expanded && extra > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-0.5 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          +{extra} more <ChevronDown size={10} />
        </button>
      )}
      {expanded && extra > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="inline-flex items-center gap-0.5 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Show less <ChevronUp size={10} />
        </button>
      )}
    </div>
  );
}

// ── Column definitions ────────────────────────────────────────────────────────

const columns: ColumnDef<MissingEntryUser>[] = [
  {
    id: 'employee',
    header: 'Employee',
    cell: ({ row }) => (
      <div>
        <div className="text-xs font-semibold">{row.original.name}</div>
        <div className="text-[11px] text-muted-foreground">{row.original.email}</div>
      </div>
    ),
  },
  {
    accessorKey: 'department',
    header: 'Department',
    cell: ({ row }) => (
      <span className="text-xs">{row.original.department ?? <span className="text-muted-foreground">—</span>}</span>
    ),
  },
  {
    accessorKey: 'totalMissing',
    header: 'Missing Days',
    cell: ({ row }) => {
      const n = row.original.totalMissing;
      const color = n > 5 ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>
          {n}
        </span>
      );
    },
  },
  {
    id: 'dates',
    header: 'Unfilled Dates',
    cell: ({ row }) => <DateChips dates={row.original.missingDates} />,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

interface Department { id: string; name: string; }

export default function MissingEntriesPage() {
  const { hasPermission } = useAuthStore();
  const router = useRouter();
  const tableId = useId();

  const canAccess =
    hasPermission('WORKFORCE_TEAM_TIMESHEET_VIEW') || hasPermission('REPORT_TIMESHEET_VIEW');

  useEffect(() => {
    if (!canAccess) router.replace('/timesheets');
  }, [canAccess, router]);

  const [from, setFrom] = useState(isoFirstOfMonth);
  const [to, setTo] = useState(isoToday);
  // Capture today once on the client so the `max` attribute is stable and
  // never differs between the SSR pass and the hydration pass.
  const [today] = useState(isoToday);
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<MissingEntryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  // Reset to page 0 when data changes.
  useEffect(() => { setPagination((p) => ({ ...p, pageIndex: 0 })); }, [data]);

  // Load departments once.
  useEffect(() => {
    adminApi.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      const result = await operationsApi.getMissingEntries({
        from,
        to,
        ...(departmentId ? { departmentId } : {}),
      });
      setData(result);
    } catch {
      setError('Failed to load missing entries. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [from, to, departmentId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Client-side name search filter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? data.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : data;
  }, [data, search]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const total = filtered.length;
  const pageStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = Math.min(pageStart + pageSize - 1, total);

  if (!canAccess) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8 animate-in">
      <div>
        <h1 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
          <AlertCircle className="text-amber-500" size={18} />
          Missing Timesheet Entries
        </h1>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1.5">
          Employees with no logged hours for working days in the selected period.
        </p>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">From</Label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">To</Label>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Department</Label>
              <Select value={departmentId || 'all'} onValueChange={(v) => setDepartmentId(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Search</Label>
              <input
                type="text"
                placeholder="Name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-bold">
            {loading ? 'Loading…' : `${total} employee${total === 1 ? '' : 's'} with missing entries`}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={data.length === 0 || loading}
            onClick={() => exportCsv(filtered)}
          >
            <Download size={13} />
            Export CSV
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="mx-4 mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground animate-pulse">Loading missing entries…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="hover:bg-transparent">
                      {hg.headers.map((h) => (
                        <TableHead key={h.id} className="text-[11px] font-black uppercase tracking-wider">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="py-14 text-center text-sm text-muted-foreground">
                        No missing entries found for the selected period and filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3 align-top">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Pagination bar ── */}
          {!loading && total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
              <div className="flex items-center gap-2">
                <Label htmlFor={`${tableId}-rpp`} className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger id={`${tableId}-rpp`} className="h-7 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-xs text-muted-foreground">
                {pageStart}–{pageEnd} of {total} employees
              </span>

              <Pagination className="w-auto justify-end">
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
                      <ChevronFirst size={13} />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                      <ChevronLeft size={13} />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                      <ChevronRight size={13} />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
                      <ChevronLast size={13} />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
