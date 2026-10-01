'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  FileText,
  Download,
  Trash2,
  Upload,
  History,
  FileArchive,
  Image as ImageIcon,
  FileSpreadsheet,
  X,
  Loader2,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DocumentPanelProps {
  entityType: string;
  entityId: string;
}

interface DocumentDto {
  id: string;
  entityType: string;
  entityId: string;
  docType: string;
  name: string;
  originalName: string;
  fileUrl: string;
  fullUrl: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isLatest: boolean;
  description?: string;
  createdAt: string;
  uploadedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

const DOC_TYPES = [
  'BRD', 'FRD', 'SOW', 'CONTRACT', 'DESIGN', 'TEST_SIGNOFF',
  'INVOICE', 'NDA', 'AGREEMENT', 'PROPOSAL', 'OTHER',
];

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (mimeType.includes('image')) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (mimeType.includes('zip')) return <FileArchive className="h-4 w-4 text-yellow-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function DocumentPanel({ entityType, entityId }: DocumentPanelProps) {
  const [groupedDocs, setGroupedDocs] = useState<Record<string, DocumentDto[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyDocType, setHistoryDocType] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/documents?entityType=${entityType}&entityId=${entityId}`);
      setGroupedDocs(res.data || {});
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    setUploading(true);
    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      form.reset();
      setUploadModalOpen(false);
      loadDocs();
    } catch (err) {
      alert('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document and all its versions?')) return;
    setDeleting(id);
    try {
      await api.delete(`/documents/${id}`);
      loadDocs();
    } catch (err) {
      alert('Delete failed.');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (id: string, name: string) => {
    try {
      const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const isEmpty = Object.keys(groupedDocs).length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
          Documents
        </h3>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity shadow-sm active:scale-95"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-xl text-center bg-muted/5">
          <FileText className="h-10 w-10 text-muted-foreground/25 mb-2" />
          <p className="text-xs font-bold text-muted-foreground">No documents yet</p>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="mt-3 text-xs text-primary hover:underline font-bold flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Upload the first document
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedDocs).map(([docType, docs]) => (
            <div key={docType} className="rounded-xl border overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-secondary/40 border-b">
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                  {docType.replace(/_/g, ' ')}
                </span>
              </div>
              <ul className="divide-y">
                {docs.map((doc) => (
                  <li key={doc.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileIcon(doc.mimeType)}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{doc.name}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>{doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</span>
                            <span>{format(new Date(doc.createdAt), 'dd MMM yyyy')}</span>
                            <span>{formatSize(doc.sizeBytes)}</span>
                            <button
                              onClick={() => setHistoryDocType(doc.docType)}
                              className="flex items-center gap-1 text-primary hover:underline font-bold"
                            >
                              <History className="h-3 w-3" /> v{doc.version}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleDownload(doc.id, doc.name)}
                          title="Download"
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={deleting === doc.id}
                          title="Delete"
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          {deleting === doc.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-2xl p-8 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-black tracking-tight uppercase flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Document
              </h3>
              <button onClick={() => setUploadModalOpen(false)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">
                  Document Type *
                </label>
                <select
                  name="docType"
                  required
                  className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none bg-background"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">
                  File *
                </label>
                <input
                  type="file"
                  name="file"
                  required
                  className="w-full text-xs text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  PDF, DOCX, XLSX, PNG, JPG, ZIP — max 50 MB
                </p>
              </div>
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">
                  Description <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold border rounded-xl hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-[2] py-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploading ? 'Uploading…' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Drawer */}
      {historyDocType && (
        <VersionHistoryDrawer
          entityType={entityType}
          entityId={entityId}
          docType={historyDocType}
          onClose={() => setHistoryDocType(null)}
        />
      )}
    </div>
  );
}

function VersionHistoryDrawer({
  entityType,
  entityId,
  docType,
  onClose,
}: {
  entityType: string;
  entityId: string;
  docType: string;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const parentRes = await api.get(`/documents?entityType=${entityType}&entityId=${entityId}`);
        const latest = (parentRes.data[docType] || [])[0];
        if (!latest) { setVersions([]); return; }
        const res = await api.get(`/documents/${latest.id}/versions`);
        setVersions(res.data);
      } catch (err) {
        console.error('Failed to load version history', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [entityType, entityId, docType]);

  const handleDownload = async (id: string, name: string) => {
    try {
      const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">
      <div className="flex-1 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b bg-secondary/20">
          <div>
            <h2 className="font-black text-base uppercase tracking-tight">Version History</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              {docType.replace(/_/g, ' ')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-8">No version history found.</p>
          ) : (
            <ul className="space-y-4 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-px before:bg-border">
              {versions.map((doc, idx) => (
                <li key={doc.id} className="relative pl-10">
                  <div className={cn(
                    'absolute left-0 top-1.5 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-black z-10 bg-background',
                    doc.isLatest ? 'border-primary text-primary' : 'border-muted-foreground/40 text-muted-foreground',
                  )}>
                    v{doc.version}
                  </div>
                  <div className="bg-card border rounded-xl p-4 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                        </p>
                        {doc.description && (
                          <p className="text-xs text-foreground/70 mt-1 leading-snug">{doc.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(doc.createdAt), 'dd MMM yyyy')}
                        </p>
                        <button
                          onClick={() => handleDownload(doc.id, doc.name)}
                          className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline font-bold"
                        >
                          <Download className="h-3 w-3" /> Download
                        </button>
                      </div>
                    </div>
                    {doc.isLatest && (
                      <span className="mt-2 inline-block px-1.5 py-0.5 rounded text-xs font-black bg-primary/10 text-primary uppercase tracking-widest">
                        Latest
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
