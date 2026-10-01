'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { deliveryTrackerApi, ReportSendRecord } from '@/lib/delivery-tracker-api';

const PAGE_SIZE = 10;

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB');

/** Audit trail of every report emailed for this project. */
export default function ReportHistoryPanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ReportSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  // Initial fetch sets state only from async callbacks — the parent mounts this
  // with key={projectId}, so switching project remounts with loading:true.
  useEffect(() => {
    let cancelled = false;
    deliveryTrackerApi
      .getReportHistory(projectId)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setError('Failed to load report history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  /** Manual refresh — an event handler, so setting state up front is fine here. */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await deliveryTrackerApi.getReportHistory(projectId));
    } catch {
      setError('Failed to load report history.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  /**
   * Filtering and paging are client-side: the endpoint already returns the
   * project's most recent 100 sends in one payload.
   */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // The date inputs are calendar days; compare against local day boundaries so
    // a send at 23:50 still falls inside its own day.
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null;

    return rows.filter((r) => {
      if (status !== 'ALL' && r.status !== status) return false;

      const sentAt = new Date(r.sentAt).getTime();
      if (fromTime !== null && sentAt < fromTime) return false;
      if (toTime !== null && sentAt > toTime) return false;

      if (!q) return true;
      return [r.sentBy, r.sentByEmail, r.preparedBy, r.subject, ...r.recipients, ...r.cc]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, status, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamped rather than reset in an effect — a stale page after filtering would
  // otherwise render an empty table for one frame.
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const filtersActive = !!search.trim() || status !== 'ALL' || !!from || !!to;
  const clearFilters = () => {
    setSearch('');
    setStatus('ALL');
    setFrom('');
    setTo('');
    setPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">
          {filtersActive
            ? `${filtered.length} of ${rows.length} ${rows.length === 1 ? 'report' : 'reports'}`
            : `${rows.length} ${rows.length === 1 ? 'report sent' : 'reports sent'}`}
        </p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Filters — every change resets to page 1, otherwise a narrowed result set
          can leave you parked past the last page. */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-border">
        <div className="flex-1 min-w-[13rem]">
          <label className="form-label">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              className="field-input pl-8 text-xs"
              placeholder="Recipient, subject, sender…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="w-32">
          <label className="form-label">Status</label>
          <select
            className="field-input text-xs"
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}
          >
            <option value="ALL">All statuses</option>
            <option value="SUCCESS">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div className="w-36">
          <label className="form-label">Sent From</label>
          <input
            className="field-input text-xs"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          />
        </div>

        <div className="w-36">
          <label className="form-label">Sent To</label>
          <input
            className="field-input text-xs"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
          />
        </div>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {error && <p className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {filtered.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Inbox size={16} />
          </div>
          <p className="text-xs text-muted-foreground">
            {rows.length === 0
              ? 'No reports have been sent for this project yet.'
              : 'No reports match these filters.'}
          </p>
          {filtersActive && rows.length > 0 && (
            <button onClick={clearFilters} className="text-xs font-medium text-primary hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sent At</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sent By</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Prepared By</th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Report Date</th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Items</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Recipients</th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((r) => {
                const isOpen = expanded === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="hover:bg-muted/40 transition-colors cursor-pointer align-top"
                  >
                    <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">{fmtDateTime(r.sentAt)}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-medium text-foreground">{r.sentBy}</p>
                      <p className="text-[11px] text-muted-foreground">{r.sentByEmail}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.preparedBy || '—'}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.reportDate)}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground tabular-nums">{r.itemCount}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[18rem]">
                      <p className={isOpen ? 'break-words' : 'truncate'}>{r.recipients.join(', ')}</p>
                      {r.cc.length > 0 && (
                        <p className={`text-[11px] text-muted-foreground/70 ${isOpen ? 'break-words' : 'truncate'}`}>
                          Cc: {r.cc.join(', ')}
                        </p>
                      )}
                      {isOpen && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1 break-words">
                          Subject: {r.subject}
                        </p>
                      )}
                      {isOpen && r.error && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 break-words">{r.error}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 whitespace-nowrap ${
                          r.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20'
                            : 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20'
                        }`}
                      >
                        {r.status === 'SUCCESS' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        {r.status === 'SUCCESS' ? 'Sent' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pager hidden on a single page — a lone "1 of 1" is just noise. */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {pageStart + 1}–{pageStart + pageRows.length} of {filtered.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[11px] text-muted-foreground tabular-nums px-1">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
