'use client';

import { useRef, useState } from 'react';
import { Download, Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { maturityApi, type MaturityBulkUploadResult } from '@/lib/maturity-api';

interface MaturityBulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

export function MaturityBulkUploadDialog({ open, onOpenChange, onUploaded }: MaturityBulkUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<MaturityBulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      await maturityApi.downloadTemplate();
    } catch {
      toast.error('Failed to download template');
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
      const res = await maturityApi.bulkUpload(file);
      setResult(res);
      if (res.created + res.updated > 0) {
        toast.success(`Bulk upload complete: ${res.created} created, ${res.updated} updated`);
        onUploaded();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed. Please check your file and try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setFile(null);
      setResult(null);
      setError(null);
      if (inputRef.current) inputRef.current.value = '';
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={16} /> Bulk Upload Maturity Records
          </DialogTitle>
          <DialogDescription>
            Download the template, fill in as many employees and months as you need, then upload it back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
              Step 1 — Download Template
            </p>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={downloading}>
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download Template (.xlsx)
            </Button>
          </div>

          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
              Step 2 — Upload Filled File
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

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          {result && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 text-xs font-black uppercase tracking-widest">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 size={14} /> Created {result.created}
                </span>
                <span className="flex items-center gap-1.5 text-blue-600">
                  <CheckCircle2 size={14} /> Updated {result.updated}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 size={14} /> Unchanged {result.unchanged}
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle size={14} /> Skipped {result.skipped}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertTriangle size={14} /> Duplicates Ignored {result.duplicates}
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-56 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-muted-foreground">{e.row}</TableCell>
                          <TableCell>{e.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
