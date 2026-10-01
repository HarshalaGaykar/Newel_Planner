'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { operationsApi, TimesheetBulkUpload, TimesheetBulkUploadReport } from '@/lib/operations-api';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Upload } from 'lucide-react';

function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

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

export default function BulkUploadTimesheetDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<TimesheetBulkUploadReport | null>(null);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<TimesheetBulkUpload[]>([]);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshUploads = useCallback(async () => {
    try {
      setUploads(await operationsApi.listTimesheetUploads());
    } catch {
      // Non-critical — leave the list as-is on error.
    }
  }, []);

  useEffect(() => {
    if (open) void refreshUploads();
  }, [open, refreshUploads]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError('');
      const blob = await operationsApi.downloadTimesheetTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timesheet-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to download template'));
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setError('');
      setReport(null);
      const res = await operationsApi.bulkUploadTimesheet(file, getBrowserTimeZone());
      setReport(res);
      if (res.imported > 0) onImported?.();
      void refreshUploads();
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRollback = async (batchId: string) => {
    try {
      setRollingBack(batchId);
      setError('');
      await operationsApi.rollbackTimesheetUpload(batchId);
      // If we're undoing the upload we just reported, clear the report.
      setReport((r) => (r?.batchId === batchId ? null : r));
      onImported?.();
      await refreshUploads();
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
        if (!o) { setReport(null); setError(''); }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileSpreadsheet size={14} /> Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Fill Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Download a template pre-filled with <span className="font-medium text-foreground">your</span> projects,
            tasks and activities. Fill each row, then upload it back. Rules: hours 0–23, minutes 0/5/…/55,
            no future dates, within the allowed back-dated window.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownload} disabled={downloading} className="gap-2">
              {downloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
              Download Template
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              Upload Filled Sheet
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
          </div>

          {error && (
            <div className="flex min-w-0 items-start gap-1.5 text-xs text-destructive">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {report && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 size={12} /> {report.imported} imported
                </span>
                <span className="text-muted-foreground">{report.skipped} skipped</span>
                {report.imported > 0 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="ml-auto gap-1 text-destructive"
                    onClick={() => handleRollback(report.batchId)}
                    disabled={rollingBack === report.batchId}
                  >
                    {rollingBack === report.batchId ? <Loader2 className="animate-spin" size={12} /> : <RotateCcw size={12} />}
                    Undo this upload
                  </Button>
                )}
              </div>
              {report.errors.length > 0 && (
                <div className="max-h-56 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Row</TableHead>
                        <TableHead>Issue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.errors.map((er) => (
                        <TableRow key={er.row}>
                          <TableCell className="font-medium">{er.row}</TableCell>
                          <TableCell className="whitespace-normal break-words text-xs">{er.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {(report.warnings?.length ?? 0) > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border border-amber-200 dark:border-amber-700/40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Row</TableHead>
                        <TableHead className="text-amber-700 dark:text-amber-400">Over estimate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.warnings!.map((w) => (
                        <TableRow key={`w-${w.row}`}>
                          <TableCell className="font-medium">{w.row}</TableCell>
                          <TableCell className="whitespace-normal break-words text-xs text-amber-700 dark:text-amber-400">
                            {w.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {report.errors.length === 0 && (report.warnings?.length ?? 0) === 0 && report.imported > 0 && (
                <p className="text-xs text-muted-foreground">All rows imported successfully.</p>
              )}
            </div>
          )}

          {uploads.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground">Recent uploads</div>
              <div className="divide-y rounded-md border">
                {uploads.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{u.fileName || 'Upload'}</div>
                      <div className="text-muted-foreground">
                        {fmtWhen(u.createdAt)} · {u.importedCount} imported
                        {u.skippedCount > 0 ? ` · ${u.skippedCount} skipped` : ''}
                      </div>
                    </div>
                    {u.status === 'ROLLED_BACK' ? (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        Undone
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="shrink-0 gap-1 text-destructive"
                        onClick={() => handleRollback(u.id)}
                        disabled={rollingBack === u.id}
                      >
                        {rollingBack === u.id ? <Loader2 className="animate-spin" size={12} /> : <RotateCcw size={12} />}
                        Undo
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
