import { AuditLogEntry } from '@/lib/tasks-api';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const FIELD_LABELS: Record<string, string> = {
  title: 'Title', description: 'Description', status: 'Status', priority: 'Priority',
  startDate: 'Start Date', endDate: 'End Date',
  assignee: 'Assignee', assigneeId: 'Assignee',
  estimatedEffort: 'Est. Effort (hrs)', taskType: 'Type', crId: 'CR', phase: 'Phase',
  progressPct: 'Progress (%)',
};

const SKIP_FIELDS = new Set(['projectId', 'id', 'createdAt', 'updatedAt', 'isCritical', 'actualEffort']);

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function displayVal(v: any) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

interface FlatRow {
  key: string;        // unique key for React
  entryId: string;
  rowSpan: number;    // how many rows this entry spans (only set on first row)
  isFirst: boolean;
  date: string;
  action: string;
  userName: string;
  field: string;
  before: string;
  after: string;
}

function buildRows(entries: AuditLogEntry[]): FlatRow[] {
  const rows: FlatRow[] = [];

  for (const entry of entries) {
    const userName = entry.user
      ? (`${entry.user.firstName ?? ''} ${entry.user.lastName ?? ''}`.trim() || entry.user.email)
      : 'System';

    // Collect field rows
    const fieldRows: { field: string; before: string; after: string }[] = [];

    if (entry.action === 'DELETE' && entry.before) {
      // Show what the task looked like before deletion
      const fields = Object.keys(entry.before).filter(k => !SKIP_FIELDS.has(k));
      for (const f of fields) {
        fieldRows.push({ field: FIELD_LABELS[f] ?? f, before: displayVal(entry.before[f]), after: '—' });
      }
    } else if (entry.after) {
      const fields = Object.keys(entry.after).filter(k => !SKIP_FIELDS.has(k));
      for (const f of fields) {
        const bv = entry.before?.[f];
        const av = entry.after[f];

        // For UPDATE entries, skip fields whose value didn't actually change
        if (entry.action === 'UPDATE') {
          const norm = (v: any) => (v === null || v === undefined || v === '') ? null : String(v);
          if (norm(bv) === norm(av)) continue;
        }

        fieldRows.push({
          field: FIELD_LABELS[f] ?? f,
          before: entry.action === 'UPDATE' ? displayVal(bv) : '—',
          after: displayVal(av),
        });
      }
    }

    if (fieldRows.length === 0) {
      // Entry with no field detail — show one summary row
      rows.push({
        key: `${entry.id}-0`,
        entryId: entry.id,
        rowSpan: 1,
        isFirst: true,
        date: formatDate(entry.createdAt),
        action: entry.action,
        userName,
        field: '—',
        before: '—',
        after: '—',
      });
    } else {
      fieldRows.forEach((fr, idx) => {
        rows.push({
          key: `${entry.id}-${idx}`,
          entryId: entry.id,
          rowSpan: idx === 0 ? fieldRows.length : 0,
          isFirst: idx === 0,
          date: formatDate(entry.createdAt),
          action: entry.action,
          userName,
          field: fr.field,
          before: fr.before,
          after: fr.after,
        });
      });
    }
  }

  return rows;
}

export default function TaskHistoryPanel({ entries, loading }: { entries: AuditLogEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50 gap-2">
        <p className="text-sm font-black uppercase tracking-widest">No history yet</p>
        <p className="text-xs">Changes to this task will appear here.</p>
      </div>
    );
  }

  const rows = buildRows(entries);

  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/60 sticky top-0 z-10">
            {['Date & Time', 'Action', 'Changed By', 'Field', 'Before', 'After'].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap border-b border-border"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            // Find if this is the start of a new entry group for alternating bg
            const entryIndex = entries.findIndex(e => e.id === row.entryId);
            const isEvenEntry = entryIndex % 2 === 0;
            const rowBg = isEvenEntry
              ? 'bg-background hover:bg-muted/30'
              : 'bg-muted/10 hover:bg-muted/30';

            return (
              <tr
                key={row.key}
                className={cn(
                  rowBg,
                  'transition-colors',
                  row.isFirst && rowIdx > 0 ? 'border-t border-border/60' : ''
                )}
              >
                {/* Date — only on first row of each entry, spans all field rows */}
                {row.isFirst && (
                  <td
                    rowSpan={row.rowSpan}
                    className="px-3 py-2 align-top whitespace-nowrap text-muted-foreground font-medium border-r border-border/30"
                  >
                    {row.date}
                  </td>
                )}

                {/* Action badge — only on first row */}
                {row.isFirst && (
                  <td
                    rowSpan={row.rowSpan}
                    className="px-3 py-2 align-top border-r border-border/30"
                  >
                    <span className={cn(
                      'inline-block px-2 py-0.5 rounded font-black uppercase tracking-wider text-xs',
                      ACTION_STYLES[row.action] ?? ACTION_STYLES.UPDATE
                    )}>
                      {row.action}
                    </span>
                  </td>
                )}

                {/* User — only on first row */}
                {row.isFirst && (
                  <td
                    rowSpan={row.rowSpan}
                    className="px-3 py-2 align-top whitespace-nowrap font-medium border-r border-border/30"
                  >
                    {row.userName}
                  </td>
                )}

                {/* Field */}
                <td className="px-3 py-2 font-black text-muted-foreground uppercase tracking-wider whitespace-nowrap border-r border-border/30">
                  {row.field}
                </td>

                {/* Before */}
                <td className="px-3 py-2 max-w-[160px] border-r border-border/30">
                  <span className={cn(
                    row.before !== '—' ? 'line-through text-muted-foreground/60' : 'text-muted-foreground/40'
                  )}>
                    {row.before}
                  </span>
                </td>

                {/* After */}
                <td className="px-3 py-2 max-w-[160px]">
                  <span className={cn(
                    row.after !== '—' ? 'text-foreground font-medium' : 'text-muted-foreground/40'
                  )}>
                    {row.after}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
