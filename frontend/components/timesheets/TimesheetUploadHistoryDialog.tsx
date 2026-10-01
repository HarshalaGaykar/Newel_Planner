'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { operationsApi, TimesheetBulkUpload } from '@/lib/operations-api';
import { AlertCircle, ChevronLeft, ChevronRight, History, Loader2, RotateCcw } from 'lucide-react';

const PAGE_SIZE = 10;

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' && error !== null && 'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
  ) {
    const message = (error as { response: { data: { message: unknown } } }).response.data.message;
    return Array.isArray(message) ? message.join(', ') : String(message);
  }
  return error instanceof Error ? error.message : fallback;
}

function ErrorsCell({ batchId, errorCount }: { batchId: string; errorCount: number }) {
  const [errors, setErrors] = useState<{ row: number; message: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  if (errorCount <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const load = async () => {
    if (errors || loading) return;
    try {
      setLoading(true);
      setLoadError('');
      const res = await operationsApi.getTimesheetUploadErrors(batchId);
      setErrors(res.errors);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load errors'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover onOpenChange={(o) => { if (o) void load(); }}>
      <PopoverTrigger asChild>
        <Badge variant="outline" className="cursor-pointer text-destructive hover:bg-destructive/10">
          {errorCount} error{errorCount === 1 ? '' : 's'}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-72 overflow-y-auto" align="end">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin" size={16} />
          </div>
        ) : loadError ? (
          <p className="text-xs text-destructive">{loadError}</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {errors?.map((e, i) => (
              <li key={i} className="border-b pb-1 last:border-0 last:pb-0">
                <span className="font-medium">Row {e.row}:</span> {e.message}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function TimesheetUploadHistoryDialog({ onRolledBack }: { onRolledBack?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<TimesheetBulkUpload[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      setError('');
      const res = await operationsApi.listTimesheetUploadHistory(targetPage, PAGE_SIZE);
      setUploads(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load upload history'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh(page);
  }, [open, page, refresh]);

  const handleRollback = async (batchId: string) => {
    try {
      setRollingBack(batchId);
      setError('');
      await operationsApi.rollbackTimesheetUpload(batchId);
      onRolledBack?.();
      await refresh(page);
    } catch (err) {
      setError(getErrorMessage(err, 'Undo failed'));
    } finally {
      setRollingBack(null);
    }
  };

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPage(1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History size={14} /> View History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Timesheet Bulk Upload History</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded At</TableHead>
                  <TableHead>Imported</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto animate-spin" size={16} />
                    </TableCell>
                  </TableRow>
                ) : uploads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      No bulk uploads yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  uploads.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-[180px] truncate font-medium" title={u.fileName || 'Upload'}>
                        {u.fileName || 'Upload'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtWhen(u.createdAt)}</TableCell>
                      <TableCell>{u.importedCount}</TableCell>
                      <TableCell>{u.skippedCount}</TableCell>
                      <TableCell>
                        <ErrorsCell batchId={u.id} errorCount={u.errorCount} />
                      </TableCell>
                      <TableCell>
                        {u.status === 'ROLLED_BACK' ? (
                          <Badge variant="secondary">Undone</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">Completed</Badge>
                        )}
                        {u.rolledBackAt && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{fmtWhen(u.rolledBackAt)}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.status !== 'ROLLED_BACK' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="gap-1 text-destructive"
                            onClick={() => handleRollback(u.id)}
                            disabled={rollingBack === u.id}
                          >
                            {rollingBack === u.id ? <Loader2 className="animate-spin" size={12} /> : <RotateCcw size={12} />}
                            Undo
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && total > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} /> Prev
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-2 text-xs text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next <ChevronRight size={14} />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
