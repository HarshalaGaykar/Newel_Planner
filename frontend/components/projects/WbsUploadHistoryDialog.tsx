'use client';

import { useEffect, useState } from 'react';
import { History, X, Loader2, AlertTriangle, Undo2, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast } from 'lucide-react';
import { tasksApi, WbsUploadBatch, WbsUndoBlocker } from '@/lib/tasks-api';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface WbsUploadHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onChanged: () => void;
}

const PAGE_SIZE = 10;

function uploaderName(u: WbsUploadBatch['uploadedBy']) {
  if (!u) return 'Unknown';
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
}

export default function WbsUploadHistoryDialog({ open, onClose, projectId, onChanged }: WbsUploadHistoryDialogProps) {
  const [page, setPage] = useState(1);
  const [batches, setBatches] = useState<WbsUploadBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<WbsUploadBatch | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [blockers, setBlockers] = useState<WbsUndoBlocker[] | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await tasksApi.getWbsUploadHistory(projectId, page, PAGE_SIZE);
      setBatches(res.data);
      setTotal(res.meta.total);
      setTotalPages(Math.max(1, res.meta.totalPages));
    } catch {
      setError('Failed to load upload history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, page]);

  if (!open) return null;

  function handleClose() {
    if (undoing) return;
    setPage(1);
    onClose();
  }

  async function confirmUndo() {
    if (!confirmTarget) return;
    setUndoing(true);
    setError(null);
    const target = confirmTarget;
    try {
      await tasksApi.undoWbsUpload(target.id);
      setConfirmTarget(null);
      await load();
      onChanged();
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; blockers?: WbsUndoBlocker[] } } })?.response?.data;
      setConfirmTarget(null);
      if (data?.blockers?.length) {
        setBlockers(data.blockers);
      } else {
        setError(data?.message || 'Undo failed. Please try again.');
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
            <History size={16} /> WBS Upload History
          </h2>
          <button onClick={handleClose} disabled={undoing} className="disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : batches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10 border rounded-xl border-dashed">
            No WBS uploads yet for this project.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground uppercase tracking-widest bg-muted/50">
                  <th className="px-4 py-2 font-black">Uploaded</th>
                  <th className="px-4 py-2 font-black">File</th>
                  <th className="px-4 py-2 font-black">Imported</th>
                  <th className="px-4 py-2 font-black">Skipped</th>
                  <th className="px-4 py-2 font-black">Status</th>
                  <th className="px-4 py-2 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-2.5">
                      <div>{new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-muted-foreground">by {uploaderName(b.uploadedBy)}</div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[10rem] truncate" title={b.fileName ?? undefined}>{b.fileName ?? '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-600">{b.importedCount}</td>
                    <td className="px-4 py-2.5 font-semibold text-amber-600">{b.skippedCount}</td>
                    <td className="px-4 py-2.5">
                      {b.status === 'ROLLED_BACK' ? (
                        <span className="text-muted-foreground">Undone</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">Completed</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {b.status === 'COMPLETED' && (
                        <button
                          onClick={() => setConfirmTarget(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Undo2 size={12} /> Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
