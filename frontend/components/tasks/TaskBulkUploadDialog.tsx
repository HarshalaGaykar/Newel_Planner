'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download, Upload, X, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle,
  History, RotateCcw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { tasksApi, WbsUploadResult, TaskBulkUpload, WbsUndoBlocker } from '@/lib/tasks-api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface TaskBulkUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const PAGE_SIZE = 10;

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
      const res = await tasksApi.getTaskBulkUploadErrors(batchId);
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

export default function TaskBulkUploadDialog({ open, onClose, onImported }: TaskBulkUploadDialogProps) {
  const [tab, setTab] = useState<'upload' | 'history'>('upload');

  // ── Upload tab state ──────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<WbsUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── History tab state ─────────────────────────────────────────────────
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [uploads, setUploads] = useState<TaskBulkUpload[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<TaskBulkUpload | null>(null);
  const [blockers, setBlockers] = useState<WbsUndoBlocker[] | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refreshHistory = useCallback(async (targetPage: number) => {
    try {
      setHistoryLoading(true);
      setHistoryError('');
      const res = await tasksApi.listTaskBulkUploadHistory(targetPage, PAGE_SIZE);
      setUploads(res.data);
      setTotal(res.total);
    } catch (err) {
      setHistoryError(getErrorMessage(err, 'Failed to load upload history'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && tab === 'history') void refreshHistory(page);
  }, [open, tab, page, refreshHistory]);

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
    if (uploading || rollingBack) return;
    reset();
    onClose();
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      await tasksApi.downloadTaskTemplate();
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
      const res = await tasksApi.bulkUploadTasks(file);
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed. Please check your file and try again.'));
    } finally {
      setUploading(false);
    }
  }

  async function confirmUndo() {
    if (!confirmTarget) return;
    try {
      setRollingBack(confirmTarget.id);
      setHistoryError('');
      await tasksApi.undoTaskBulkUpload(confirmTarget.id);
      setConfirmTarget(null);
      onImported();
      await refreshHistory(page);
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; blockers?: WbsUndoBlocker[] } } })?.response?.data;
      setConfirmTarget(null);
      if (data?.blockers?.length) {
        setBlockers(data.blockers);
      } else {
        setHistoryError(getErrorMessage(err, 'Undo failed. Please try again.'));
      }
    } finally {
      setRollingBack(null);
    }
  }

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  };
  const uploaderName = (u: TaskBulkUpload['uploadedBy']) =>
    u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : '—';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      <div className="bg-card border rounded-xl p-6 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
            <FileSpreadsheet size={16} /> Bulk Upload Tasks
          </h2>
          <button onClick={handleClose} disabled={uploading || !!rollingBack} className="disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'history')}>
          <TabsList variant="line" size="sm" className="mb-5">
            <TabsTrigger value="upload">Bulk Upload</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History size={13} /> View History
            </TabsTrigger>
          </TabsList>

          {/* ── Bulk Upload tab ── */}
          <TabsContent value="upload">
            <div className="mb-5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                Step 1 — Download template
              </p>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Fill in the <b>Tasks</b> sheet. <b>Title</b>, <b>Start Date</b>, <b>End Date</b> and <b>Project</b> are
                required. Pick <b>Project</b>, <b>Priority</b>, <b>Status</b> and <b>Task Type</b> from the in-cell
                dropdowns. Choose the <b>Project</b> first — the <b>Assignees</b> dropdown then lists only that
                project&apos;s allocated users as &quot;Name &lt;email&gt;&quot;. For multiple people, type them
                comma-separated; unknown or unallocated entries are skipped with a warning. Row 2 is a filled-in
                example — overwrite it with your own tasks.
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
            <div className="space-y-3 text-sm">
              {historyError && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{historyError}</span>
                </div>
              )}

              <div className="max-h-[55vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Uploaded At</TableHead>
                      <TableHead>Imported</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                          <Loader2 className="mx-auto animate-spin" size={16} />
                        </TableCell>
                      </TableRow>
                    ) : uploads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                          No bulk uploads yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      uploads.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="max-w-[160px] truncate font-medium" title={u.fileName || 'Upload'}>
                            {u.fileName || 'Upload'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{uploaderName(u.uploadedBy)}</TableCell>
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
                                onClick={() => setConfirmTarget(u)}
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

              {!historyLoading && total > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} /> Prev
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-8 pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 text-xs font-black uppercase tracking-widest border rounded-lg hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm undo */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && !rollingBack && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {confirmTarget?.importedCount} task{confirmTarget?.importedCount === 1 ? '' : 's'} it
              created from &quot;{confirmTarget?.fileName ?? 'this file'}&quot;. Manually created tasks are never affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!rollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUndo} disabled={!!rollingBack}>
              {rollingBack ? <Loader2 size={14} className="animate-spin" /> : 'Undo Upload'}
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
              <thead className="sticky top-0 bg-muted/50">
                <tr className="text-left text-muted-foreground uppercase tracking-widest">
                  <th className="px-3 py-2 font-black">Task</th>
                  <th className="px-3 py-2 font-black">Person</th>
                  <th className="px-3 py-2 font-black">Hours</th>
                </tr>
              </thead>
              <tbody>
                {blockers?.map((b, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{b.taskTitle}</td>
                    <td className="px-3 py-2">{b.personName}</td>
                    <td className="px-3 py-2">{b.totalHours}</td>
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
