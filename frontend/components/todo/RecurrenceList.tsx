'use client';

import { useState } from 'react';
import { CalendarClock, MoreVertical, Repeat, XCircle } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ActivityRecurrence, RecurrenceStatus } from '@/lib/activities-api';

const STATUS_STYLES: Record<RecurrenceStatus, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};

const HEAD_CLASS =
  'px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap';

const COLUMN_COUNT = 6;

function formatNext(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  series: ActivityRecurrence[];
  loading: boolean;
  busyId?: string | null;
  onCancel: (series: ActivityRecurrence) => void;
}

export default function RecurrenceList({ series, loading, busyId, onCancel }: Props) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
              <TableHead className={HEAD_CLASS}>Activity</TableHead>
              <TableHead className={HEAD_CLASS}>Repeats</TableHead>
              <TableHead className={HEAD_CLASS}>Next Due</TableHead>
              <TableHead className={HEAD_CLASS}>Progress</TableHead>
              <TableHead className={HEAD_CLASS}>Status</TableHead>
              <TableHead className={`${HEAD_CLASS} text-right`}>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y text-sm">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }).map((__, c) => (
                    <TableCell key={c} className="px-4 py-3">
                      <Skeleton className="h-3.5 w-full max-w-[160px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : series.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="px-6 py-12 text-center">
                  <Repeat className="mx-auto mb-3 size-8 text-muted-foreground/60" />
                  <p className="text-sm font-semibold">No repeating activities</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Set "Repeat" when creating an activity to make it daily, weekly or monthly.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              series.map((item) => {
                const busy = busyId === item.id;

                return (
                  <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="px-4 py-3 align-top">
                      <span className="font-bold text-foreground">{item.name}</span>
                      {item.description && (
                        <p className="mt-1 line-clamp-2 max-w-xs whitespace-pre-wrap text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.assignees.map((a) => a.name).join(', ') || '—'}
                      </p>
                    </TableCell>

                    <TableCell className="px-4 py-3 align-top text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Repeat size={11} className="shrink-0" />
                        {item.summary}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3 align-top whitespace-nowrap text-muted-foreground">
                      {formatNext(item.nextOccurrenceAt)}
                    </TableCell>

                    <TableCell className="px-4 py-3 align-top text-muted-foreground">
                      {item.completedCount} done · {item.pendingCount} pending
                    </TableCell>

                    <TableCell className="px-4 py-3 align-top">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs font-black uppercase tracking-tighter ${STATUS_STYLES[item.status]}`}
                      >
                        {item.status}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3 align-top">
                      {item.status === 'ACTIVE' ? (
                        <div className="flex justify-end">
                          <DropdownMenu
                            open={openDropdownId === item.id}
                            onOpenChange={(isOpen) =>
                              setOpenDropdownId(isOpen ? item.id : null)
                            }
                          >
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={busy}
                                className="h-8 w-8 rounded-full"
                                title="Actions"
                              >
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  onCancel(item);
                                }}
                                className="gap-2 text-sm text-destructive focus:text-destructive"
                                title="Stop this series and cancel its upcoming activities"
                              >
                                <XCircle size={13} className="shrink-0" />
                                Stop Series
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                          <CalendarClock size={11} />
                          No longer repeating
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
