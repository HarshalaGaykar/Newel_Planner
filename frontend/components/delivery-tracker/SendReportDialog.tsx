'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, X, AlertTriangle, CheckCircle2, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import RichTextEditor from '@/components/ui/rich-text-editor';
import {
  deliveryTrackerApi,
  ReportPreview,
} from '@/lib/delivery-tracker-api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground mt-0.5 break-words">{value}</p>
    </div>
  );
}

function EmailChipInput({
  label,
  emails,
  onChange,
}: {
  label: string;
  emails: string[];
  onChange: (emails: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const value = draft.trim().replace(/,$/, '');
    if (!value) return;
    if (!EMAIL_RE.test(value)) { setError('Enter a valid email address.'); return; }
    if (emails.some((e) => e.toLowerCase() === value.toLowerCase())) { setDraft(''); return; }
    onChange([...emails, value]);
    setDraft('');
    setError('');
  };

  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {emails.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium">
            {e}
            <button type="button" onClick={() => onChange(emails.filter((x) => x !== e))} className="text-muted-foreground hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <input
        className="field-input"
        placeholder="Add an email and press Enter…"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function SendReportDialog({
  projectId,
  projectName,
  open,
  onClose,
  onOpenRecipients,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
  onOpenRecipients: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlError, setHtmlError] = useState('');
  const [includeExcel, setIncludeExcel] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setSent(false);
    setReportHtml('');
    setHtmlError('');
    deliveryTrackerApi
      .getReportPreview(projectId)
      .then((data) => {
        setPreview(data);
        setTo(data.to);
        setCc(data.cc);
        setPreparedBy(data.preparedBy);
        // <input type="date"> needs YYYY-MM-DD.
        setReportDate(new Date(data.reportDate).toISOString().slice(0, 10));
        setSubject(`Delivery Tracker Report - ${data.projectName} - ${new Date(data.reportDate).toLocaleDateString('en-GB')}`);
        setBody(
          `Hi,\n\nPlease find the updated status report for ${data.projectName} below.\n\nRegards,\n${data.preparedBy}`,
        );
      })
      .catch(() => setError('Failed to load report preview.'))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const handleSend = async () => {
    if (to.length === 0) { setError('Add at least one To recipient before sending.'); return; }
    setSending(true);
    setError('');
    try {
      // Header fields are omitted on purpose — the backend reads them from the
      // project's saved report settings, so there is one source of truth.
      await deliveryTrackerApi.sendReport(projectId, {
        to, cc, subject, body,
        includeExcelAttachment: includeExcel,
      });
      setSent(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to send the report. Please try again.');
    } finally {
      setSending(false);
    }
  };

  /**
   * The preview is the server-rendered email body, fetched on demand — so what is
   * reviewed here is the same markup recipients receive, not a reimplementation.
   */
  const openPreview = () => {
    setShowPreview(true);
    if (reportHtml || htmlLoading) return;
    setHtmlLoading(true);
    setHtmlError('');
    deliveryTrackerApi
      .getReportHtml(projectId)
      .then(setReportHtml)
      .catch(() => setHtmlError('Failed to render the report preview.'))
      .finally(() => setHtmlLoading(false));
  };

  const noRecipientsConfigured = !loading && !!preview && preview.to.length === 0 && preview.cc.length === 0;

  // Preview reflects the edited date, not the one fetched with the report.
  const displayReportDate = reportDate
    ? new Date(`${reportDate}T00:00:00`).toLocaleDateString('en-GB')
    : '—';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* flex column with a single scrolling body — a nested scroller here would
          swallow the wheel and strand the fields above it. */}
      <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b border-border text-left">
          <DialogTitle>Send Delivery Tracker Report</DialogTitle>
          <DialogDescription>
            Review and edit the recipients, message, and status summary before sending.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : sent ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Report sent successfully.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {noRecipientsConfigured && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">No recipients configured for this project yet.</p>
                  <p className="mt-0.5">
                    You can still add addresses below for this send, or{' '}
                    <button type="button" onClick={onOpenRecipients} className="underline font-medium">
                      set up recipients
                    </button>{' '}
                    to reuse them next time.
                  </p>
                </div>
              </div>
            )}

            <EmailChipInput label="To" emails={to} onChange={setTo} />
            <EmailChipInput label="Cc" emails={cc} onChange={setCc} />

            <div>
              <label className="form-label">Subject</label>
              <input className="field-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div>
              <label className="form-label">Message</label>
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Covering message shown above the report…"
                minHeight="min-h-[11rem]"
              />
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-sm font-semibold text-foreground mb-3">Report Preview — {projectName}</p>

              {/* Read-only here: Report Date, Prepared By and Status Summary are
                  authored on the tracker screen so the same values feed the
                  export, the preview and the emailed report. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                <ReadOnlyField label="Report Date" value={displayReportDate} />
                <ReadOnlyField label="Prepared By" value={preparedBy || '—'} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {preview?.rows.length ?? 0} {preview?.rows.length === 1 ? 'item' : 'items'} in the report
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    The report is included in the email body — open the preview to check it before sending.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openPreview}
                  className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Eye size={13} /> View
                </button>
              </div>

              <label className="mt-2.5 flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 accent-primary"
                  checked={includeExcel}
                  onChange={(e) => setIncludeExcel(e.target.checked)}
                />
                <span className="text-[11px] text-muted-foreground leading-snug">
                  Also attach the Excel workbook
                </span>
              </label>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {/* Full report preview — the server-rendered email body itself, shown in a
            sandboxed iframe so its inline email styles cannot leak into the app
            (or inherit from it). A plain fixed overlay, not a nested Radix dialog,
            to avoid two focus traps fighting each other. */}
        {showPreview && preview && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowPreview(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Report preview"
          >
            <div
              className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Report Preview</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Exactly what recipients will see in the email body.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  aria-label="Close preview"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 min-h-0 bg-white">
                {htmlLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : htmlError ? (
                  <div className="h-full flex items-center justify-center px-6">
                    <p className="text-sm text-red-500">{htmlError}</p>
                  </div>
                ) : (
                  <iframe
                    title="Report preview"
                    srcDoc={reportHtml}
                    // No allow-scripts: the report is pure markup, so the iframe
                    // stays script-free even though the HTML is server-generated.
                    sandbox=""
                    className="w-full h-full border-0"
                  />
                )}
              </div>

              <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
                <button onClick={() => setShowPreview(false)} className="btn btn-ghost text-sm">Close</button>
              </div>
            </div>
          </div>
        )}

        {!loading && !sent && (
          <DialogFooter className="px-5 py-4 border-t border-border shrink-0">
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={handleSend} disabled={sending} className="btn btn-primary text-sm flex items-center gap-1.5">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
