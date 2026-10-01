'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Download, Upload, X, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle,
  History, RotateCcw, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast,
} from 'lucide-react';
import { tasksApi, WbsUploadResult, WbsUploadBatch, WbsUndoBlocker } from '@/lib/tasks-api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface WbsUploadDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onImported: () => void;
}

const PAGE_SIZE = 10;

function uploaderName(u: WbsUploadBatch['uploadedBy']) {
  if (!u) return 'Unknown';
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
}

function getErrorMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  if (data?.message) return Array.isArray(data.message) ? data.message.join(', ') : String(data.message);
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
      const res = await tasksApi.getWbsUploadErrors(batchId);
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
      <PopoverContent className="w-96 max-h-72 overflow-y-auto z-[10000]" align="end">
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

export default function WbsUploadDialog({ open, onClose, projectId, onImported }: WbsUploadDialogProps) {
  const [tab, setTab] = useState<'upload' | 'history'>('upload');

  // ── Upload tab state ──────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<WbsUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── History tab state ─────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [batches, setBatches] = useState<WbsUploadBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<WbsUploadBatch | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [blockers, setBlockers] = useState<WbsUndoBlocker[] | null>(null);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await tasksApi.getWbsUploadHistory(projectId, page, PAGE_SIZE);
      setBatches(res.data);
      setTotal(res.meta.total);
      setTotalPages(Math.max(1, res.meta.totalPages));
    } catch {
      setHistoryError('Failed to load upload history.');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (open && tab === 'history') loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, projectId, page]);

  if (!open) return null;

  function reset() {
    setTab('upload');
    setFile(null);
    setResult(null);
    setError(null);
    setPage(1);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleClose() {
    if (uploading || undoing) return;
    reset();
    onClose();
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      await tasksApi.downloadWbsTemplate();
    } catch {
      setError('Failed to download template.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await tasksApi.uploadWbs(file, projectId);
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Upload failed. Please check your file and try again.');
    } finally {
      setUploading(false);
    }
  }

  async function confirmUndo() {
    if (!confirmTarget) return;
    setUndoing(true);
    setHistoryError(null);
    const target = confirmTarget;
    try {
      await tasksApi.undoWbsUpload(target.id);
      setConfirmTarget(null);
      await loadHistory();
      onImported();
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; blockers?: WbsUndoBlocker[] } } })?.response?.data;
      setConfirmTarget(null);
      if (data?.blockers?.length) {
        setBlockers(data.blockers);
      } else {
        setHistoryError(data?.message || 'Undo failed. Please try again.');
      }
    } finally {
      setUndoing(false);
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      <div className="bg-card border rounded-xl p-6 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
            <FileSpreadsheet size={16} /> WBS Upload
          </h2>
          <button onClick={handleClose} disabled={uploading || undoing} className="disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'history')}>
          <TabsList variant="line" size="sm" className="mb-5">
            <TabsTrigger value="upload">WBS Upload</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History size={13} /> View History
            </TabsTrigger>
          </TabsList>

          {/* ── WBS Upload tab ── */}
          <TabsContent value="upload">
            {/* Step 1 — template */}
            <div className="mb-5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                Step 1 — Download template
              </p>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Fill in the <b>WBS</b> sheet. A <b>SUBTASK</b> must set <b>Parent Title</b> to the <b>TASK</b> it
                belongs to; other rows only nest when Parent Title is filled. <b>Assignee Email</b> is required —
                blank, an email not found in the system, or a user not allocated to this project, causes the row to
                be skipped. See the <b>Instructions</b> sheet for every column.
              </p>
              <button
                onClick={handleDownloadTemplate}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-black uppercase tracking-widest hover:bg-muted transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Download Template (.xlsx)
              </button>
            </div>

            {/* Step 2 — upload */}
            <div className="mb-2">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                Step 2 — Upload filled file
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setResult(null);
                  setError(null);
                }}
                className="w-full text-xs text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
              />
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Result panel */}
            {result && (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 text-xs font-black uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 size={14} /> Imported {result.imported}
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle size={14} /> Skipped {result.skipped}
                  </span>
                </div>
                {result.errors.length > 0 && (
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-left text-muted-foreground uppercase tracking-widest">
                          <th className="px-4 py-2 font-black w-16">Row</th>
                          <th className="px-4 py-2 font-black">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-4 py-2 font-mono text-muted-foreground">{e.row}</td>
                            <td className="px-4 py-2">{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="px-6 py-2 text-xs font-black uppercase tracking-widest border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                {result ? 'Done' : 'Cancel'}
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex items-center gap-2 px-8 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-lg hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </TabsContent>

          {/* ── View History tab ── */}
          <TabsContent value="history">
            {historyError && (
              <div className="mb-4 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{historyError}</span>
              </div>
            )}

            {historyLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={22} className="animate-spin text-muted-foreground" />
              </div>
            ) : batches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 border rounded-xl border-dashed">
                No WBS uploads yet for this project.
              </p>
            ) : (
              <div className="max-h-[55vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Imported</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div>{new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div className="text-xs text-muted-foreground">by {uploaderName(b.uploadedBy)}</div>
                        </TableCell>
                        <TableCell className="max-w-[10rem] truncate" title={b.fileName ?? undefined}>{b.fileName ?? '—'}</TableCell>
                        <TableCell>{b.importedCount}</TableCell>
                        <TableCell>{b.skippedCount}</TableCell>
                        <TableCell>
                          <ErrorsCell batchId={b.id} errorCount={b.errorCount} />
                        </TableCell>
                        <TableCell>
                          {b.status === 'ROLLED_BACK' ? (
                            <Badge variant="secondary">Undone</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">Completed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {b.status === 'COMPLETED' && (
                            <Button
                              variant="ghost"
                              size="xs"
                              className="gap-1 text-destructive"
                              onClick={() => setConfirmTarget(b)}
                            >
                              <RotateCcw size={12} />
                              Undo
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {total > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/5 px-4 py-3 mt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  Showing {rangeStart}–{rangeEnd} of {total} upload{total === 1 ? '' : 's'}
                </span>
                <Pagination className="w-auto justify-end">
                  <PaginationContent className="gap-1">
                    <PaginationItem>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page <= 1}>
                        <ChevronFirst size={14} />
                      </Button>
                    </PaginationItem>
                    <PaginationItem>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                        <ChevronLeft size={14} />
                      </Button>
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-2 text-xs font-semibold text-muted-foreground">Page {page} of {totalPages}</span>
                    </PaginationItem>
                    <PaginationItem>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                        <ChevronRight size={14} />
                      </Button>
                    </PaginationItem>
                    <PaginationItem>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
                        <ChevronLast size={14} />
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                disabled={undoing}
                className="px-6 py-2 text-xs font-black uppercase tracking-widest border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm undo */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && !undoing && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {confirmTarget?.importedCount} task{confirmTarget?.importedCount === 1 ? '' : 's'} it
              created from &quot;{confirmTarget?.fileName ?? 'this file'}&quot;. Manually created tasks are never affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={undoing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUndo} disabled={undoing}>
              {undoing ? <Loader2 size={14} className="animate-spin" /> : 'Undo Upload'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blocked — time already logged */}
      <AlertDialog open={!!blockers} onOpenChange={(o) => !o && setBlockers(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot undo — time already logged</AlertDialogTitle>
            <AlertDialogDescription>
              These people have already logged timesheet hours against tasks from this upload. Undo is blocked to avoid
              losing their logged time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-56 overflow-y-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground uppercase tracking-widest bg-muted/50">
                  <th className="px-3 py-2 font-black">Task</th>
                  <th className="px-3 py-2 font-black">Person</th>
                  <th className="px-3 py-2 font-black text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {blockers?.map((b, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{b.taskTitle}</td>
                    <td className="px-3 py-2">{b.personName}</td>
                    <td className="px-3 py-2 text-right font-semibold">{b.totalHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBlockers(null)}>OK</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
