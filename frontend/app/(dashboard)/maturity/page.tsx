'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { GaugeCircle, Plus, Search, MoreHorizontal, Pencil, Upload, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/lib/store/auth';
import { maturityApi, type EmployeeMaturity, type EmployeeMaturityHistoryRow } from '@/lib/maturity-api';
import { MaturityFormDialog } from '@/components/maturity/MaturityFormDialog';
import { MaturityBulkUploadDialog } from '@/components/maturity/MaturityBulkUploadDialog';

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MaturityPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('MATURITY_MANAGE');

  const [records, setRecords] = useState<EmployeeMaturity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<EmployeeMaturity | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<EmployeeMaturity | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [historyByUser, setHistoryByUser] = useState<Record<string, EmployeeMaturityHistoryRow[] | 'loading'>>({});

  async function toggleExpand(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
    if (!historyByUser[userId]) {
      setHistoryByUser((prev) => ({ ...prev, [userId]: 'loading' }));
      try {
        const rows = await maturityApi.getHistory(userId);
        setHistoryByUser((prev) => ({ ...prev, [userId]: rows }));
      } catch {
        setHistoryByUser((prev) => ({ ...prev, [userId]: [] }));
        toast.error('Failed to load history');
      }
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await maturityApi.getAll({
        isActive: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      });
      setRecords(data);
      // Invalidate cached history so edits/bulk-uploads don't show stale months.
      setHistoryByUser({});
      setExpanded(new Set());
    } catch {
      toast.error('Failed to load maturity records');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  async function handleToggleActive(record: EmployeeMaturity, nextActive: boolean) {
    if (!nextActive) {
      setDeactivateTarget(record);
      return;
    }
    try {
      await maturityApi.update(record.userId, { forTheMonth: record.forTheMonth, isActive: true });
      toast.success(`${record.userName} marked active`);
      load();
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    try {
      await maturityApi.update(deactivateTarget.userId, {
        forTheMonth: deactivateTarget.forTheMonth,
        isActive: false,
      });
      toast.success(`${deactivateTarget.userName} marked inactive`);
      load();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setDeactivateTarget(null);
    }
  }

  const columns = useMemo<ColumnDef<EmployeeMaturity>[]>(
    () => [
      {
        id: 'expander',
        header: () => <span className="sr-only">Expand</span>,
        cell: ({ row }) => {
          const isOpen = expanded.has(row.original.userId);
          return (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => toggleExpand(row.original.userId)}
              aria-label={isOpen ? 'Hide history' : 'Show history'}
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </Button>
          );
        },
      },
      {
        id: 'userName',
        header: 'Employee',
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.userName}</span>,
      },
      {
        id: 'currentMaturityValue',
        header: 'Maturity Value',
        cell: ({ row }) => <span className="font-semibold">{row.original.currentMaturityValue.toFixed(2)}</span>,
      },
      {
        id: 'forTheMonth',
        header: 'For The Month',
        cell: ({ row }) => formatMonth(row.original.forTheMonth),
      },
      {
        id: 'remarks',
        header: 'Remarks',
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-1 max-w-[220px] inline-block">
            {row.original.remarks || '—'}
          </span>
        ),
      },
      {
        id: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <Switch
            checked={row.original.isActive}
            onCheckedChange={(checked) => handleToggleActive(row.original, checked)}
            disabled={!canManage}
          />
        ),
      },
      {
        id: 'updatedAt',
        header: 'Last Updated',
        cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.updatedAt)}</span>,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) =>
          canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-7">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setEditRecord(row.original);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={13} /> Edit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null,
      },
    ],
    [canManage, expanded],
  );

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GaugeCircle size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Employee Maturity</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track and update each employee&apos;s current maturity score.</p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
              <Upload size={14} /> Bulk Upload
            </Button>
            <Button
              onClick={() => {
                setEditRecord(null);
                setFormOpen(true);
              }}
            >
              <Plus size={14} /> Add Employee Maturity
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee name or remarks..."
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => {
                    const isOpen = expanded.has(row.original.userId);
                    const history = historyByUser[row.original.userId];
                    return (
                      <Fragment key={row.id}>
                        <TableRow>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                          ))}
                        </TableRow>
                        {isOpen && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={columns.length} className="bg-muted/30 p-0">
                              <div className="px-6 py-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                  Maturity History — {row.original.userName}
                                </p>
                                {history === 'loading' || history === undefined ? (
                                  <Skeleton className="h-16 w-full" />
                                ) : history.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-2">No history recorded.</p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Month</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Remarks</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Recorded / Modified</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {history.map((h) => (
                                        <TableRow key={h.id}>
                                          <TableCell>{formatMonth(h.forTheMonth)}</TableCell>
                                          <TableCell className="font-semibold">{h.maturityValue.toFixed(2)}</TableCell>
                                          <TableCell className="text-muted-foreground">{h.remarks || '—'}</TableCell>
                                          <TableCell className="text-muted-foreground">{h.isActive ? 'Active' : 'Inactive'}</TableCell>
                                          <TableCell className="text-muted-foreground">
                                            {formatDateTime(h.updatedAt || h.createdAt)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-10">
                      No maturity records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <MaturityFormDialog open={formOpen} onOpenChange={setFormOpen} record={editRecord} onSaved={load} />

      <MaturityBulkUploadDialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen} onUploaded={load} />

      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as inactive?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.userName} will be marked inactive. You can reactivate this record at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>Mark Inactive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
