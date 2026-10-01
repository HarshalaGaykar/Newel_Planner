'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, FileText, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deliveryTrackerApi, ReportSettings } from '@/lib/delivery-tracker-api';
import RichTextEditor from '@/components/ui/rich-text-editor';

/**
 * The report header for a project — Report Date, Prepared By and Status Summary.
 * Authored here rather than at send time so the Excel export, the send preview
 * and the emailed attachment all read the same saved values.
 */
export default function ReportDetailsCard({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<Pick<ReportSettings, 'updatedAt' | 'updatedBy'>>({
    updatedAt: null,
    updatedBy: null,
  });

  const [reportDate, setReportDate] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [statusSummary, setStatusSummary] = useState('');
  const [dirty, setDirty] = useState(false);

  // State is only set from async callbacks, never synchronously in the effect
  // body. The parent mounts this with key={projectId}, so a project switch
  // remounts with loading:true rather than needing a reset here.
  useEffect(() => {
    let cancelled = false;
    deliveryTrackerApi
      .getReportSettings(projectId)
      .then((s) => {
        if (cancelled) return;
        setReportDate(s.reportDate ? s.reportDate.slice(0, 10) : '');
        setPreparedBy(s.preparedBy ?? '');
        setStatusSummary(s.statusSummary ?? '');
        setMeta({ updatedAt: s.updatedAt, updatedBy: s.updatedBy });
        setDirty(false);
      })
      .catch(() => { if (!cancelled) setError('Failed to load report details.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const s = await deliveryTrackerApi.saveReportSettings(projectId, {
        reportDate: reportDate || undefined,
        preparedBy: preparedBy.trim() || undefined,
        statusSummary: statusSummary.trim() || undefined,
      });
      setMeta({ updatedAt: s.updatedAt, updatedBy: s.updatedBy });
      setDirty(false);
      setSavedAt(new Date().toISOString());
      window.setTimeout(() => setSavedAt(null), 2500);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const track = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  return (
    <div className="border border-border rounded-xl bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          <FileText size={14} className="text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Report Details</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Used by the Excel export, the preview and the emailed report
              {meta.updatedBy ? ` · last updated by ${meta.updatedBy}` : ''}
            </p>
          </div>
          {open ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {savedAt && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check size={12} /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        </div>
      </div>

      {open && (
        <div className={cn('px-4 pb-4 space-y-3 border-t border-border pt-3', loading && 'opacity-60 pointer-events-none')}>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label" htmlFor="rd-date">Report Date</label>
              <input
                id="rd-date"
                type="date"
                className="field-input"
                value={reportDate}
                onChange={(e) => track(setReportDate)(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Leave blank to use the date the report is generated.</p>
            </div>
            <div>
              <label className="form-label" htmlFor="rd-by">Prepared By</label>
              <input
                id="rd-by"
                className="field-input"
                placeholder="Name shown on the report"
                value={preparedBy}
                onChange={(e) => track(setPreparedBy)(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Leave blank to use whoever exports or sends it.</p>
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="rd-summary">Status Summary</label>
            <RichTextEditor
              value={statusSummary}
              onChange={track(setStatusSummary)}
              placeholder="Narrative summary that appears above the item table…"
              minHeight="min-h-[9rem]"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Leave blank to auto-generate one from every item&apos;s remarks, newest first.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
