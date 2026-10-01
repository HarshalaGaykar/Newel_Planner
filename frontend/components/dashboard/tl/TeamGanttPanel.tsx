'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import {
  AlertCircle, Calendar, ChevronLeft, ChevronRight, RefreshCw, Flame,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth';
import { usersApi } from '@/lib/users-api';
import { projectsApi } from '@/lib/projects-api';
import { tlDashboardApi, GanttResponse, GanttScope, GanttTaskRow, WithinEstimate } from '@/lib/tl-dashboard-api';

const STATUS_OPTIONS = ['BACKLOG', 'TODO', 'WIP', 'QA', 'COMPLETED'];
const WITHIN_ESTIMATE_OPTIONS: { value: WithinEstimate; label: string }[] = [
  { value: 'WITHIN', label: 'Within estimate' },
  { value: 'OVER', label: 'Over estimate' },
  { value: 'UNESTIMATED', label: 'Unestimated' },
];

const WITHIN_ESTIMATE_STYLE: Record<WithinEstimate, string> = {
  WITHIN: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  OVER: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  UNESTIMATED: 'bg-muted text-muted-foreground',
};

const PAGE_SIZE = 10;

function assigneeName(a: GanttTaskRow['assignee']) {
  if (!a) return '—';
  return `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '—';
}

function TimelineBar({ row, windowStart, windowEnd }: { row: GanttTaskRow; windowStart: Date; windowEnd: Date }) {
  if (!row.plannedStart || !row.plannedEnd) {
    return <span className="text-xs text-muted-foreground">No planned dates</span>;
  }
  const totalMs = windowEnd.getTime() - windowStart.getTime();
  if (totalMs <= 0) return null;

  const pct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - windowStart.getTime()) / totalMs) * 100));
  const barStart = pct(new Date(row.plannedStart));
  const barEnd = pct(new Date(row.plannedEnd));
  const barWidth = Math.max(barEnd - barStart, 1.5);
  const isOverdue = row.withinEstimate === 'OVER';

  return (
    <div className="relative h-5 w-full min-w-32 bg-muted/40 rounded">
      <div
        className="absolute inset-y-1 rounded"
        style={{
          left: `${barStart}%`,
          width: `${barWidth}%`,
          backgroundColor: isOverdue ? '#ef4444' : 'var(--color-primary)',
          opacity: 0.85,
        }}
      />
    </div>
  );
}

export default function TeamGanttPanel() {
  const { user } = useAuthStore();

  const [scope, setScope] = useState<GanttScope>('ME');
  const [memberId, setMemberId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [withinEstimate, setWithinEstimate] = useState<WithinEstimate | ''>('');
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [page, setPage] = useState(1);

  const [members, setMembers] = useState<SearchableSelectOption[]>([]);
  const [projects, setProjects] = useState<SearchableSelectOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [result, setResult] = useState<GanttResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setOptionsLoading(true);
    Promise.all([usersApi.getTeamMembers(), projectsApi.getAll()])
      .then(([teamMembers, allProjects]) => {
        setMembers(
          teamMembers
            .filter((m) => m.id !== user?.id)
            .map((m) => ({ value: m.id, label: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email, sublabel: m.email })),
        );
        setProjects(allProjects.map((p) => ({ value: p.id, label: p.name })));
      })
      .catch((err) => console.error('Error fetching filter options:', err))
      .finally(() => setOptionsLoading(false));
  }, [user?.id]);

  const updateFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await tlDashboardApi.getGantt({
        scope,
        memberId: scope === 'MEMBER' ? memberId : undefined,
        projectId: projectId || undefined,
        status: status || undefined,
        withinEstimate: withinEstimate || undefined,
        from,
        to,
        page,
        limit: PAGE_SIZE,
      });
      setResult(data);
    } catch {
      setResult(null);
      setError('Failed to load the Gantt view.');
    } finally {
      setLoading(false);
    }
  }, [scope, memberId, projectId, status, withinEstimate, from, to, page]);

  useEffect(() => {
    // scope=MEMBER with no member picked yet — wait rather than firing a request that will 400.
    if (scope === 'MEMBER' && !memberId) {
      setResult({ data: [], meta: { total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 } });
      setLoading(false);
      return;
    }
    load();
  }, [load, scope, memberId]);

  const windowStart = useMemo(() => new Date(from), [from]);
  const windowEnd = useMemo(() => new Date(to), [to]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <Tabs value={scope} onValueChange={updateFilter(setScope) as (v: string) => void}>
            <TabsList shape="pill">
              <TabsTrigger value="ME">Me</TabsTrigger>
              <TabsTrigger value="MEMBER">Team Member</TabsTrigger>
              <TabsTrigger value="TEAM">Whole Team</TabsTrigger>
            </TabsList>
          </Tabs>

          {scope === 'MEMBER' && (
            <div className="w-56">
              <SearchableSelect
                options={members}
                value={memberId}
                onValueChange={updateFilter(setMemberId)}
                allLabel="Select a team member"
                loading={optionsLoading}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <div className="w-44">
              <SearchableSelect
                options={projects}
                value={projectId}
                onValueChange={updateFilter(setProjectId)}
                allLabel="All Projects"
                loading={optionsLoading}
              />
            </div>
            <Select value={status} onValueChange={updateFilter(setStatus)}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={withinEstimate} onValueChange={(v) => updateFilter(setWithinEstimate)(v as WithinEstimate)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Estimate status" /></SelectTrigger>
              <SelectContent>
                {WITHIN_ESTIMATE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-muted-foreground" />
              <Input type="date" value={from} onChange={(e) => updateFilter(setFrom)(e.target.value)} className="w-36 h-9 text-xs" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={to} min={from} onChange={(e) => updateFilter(setTo)(e.target.value)} className="w-36 h-9 text-xs" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          {error ? (
            <div className="p-12 text-center flex flex-col items-center gap-3">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
                <RefreshCw size={14} /> Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : scope === 'MEMBER' && !memberId ? (
            <p className="p-12 text-center text-sm text-muted-foreground">Pick a team member to see their tasks.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead className="w-48">Timeline</TableHead>
                  <TableHead className="text-right">Estimate</TableHead>
                  <TableHead className="text-right">Logged</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(result?.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-56">
                      {row.parent && (
                        <p className="text-xs text-muted-foreground truncate">{row.parent.title}</p>
                      )}
                      <div className="flex items-center gap-1.5">
                        {row.priority === 'CRITICAL' && <Flame size={12} className="text-red-500 shrink-0" />}
                        <span className="text-sm font-medium truncate">{row.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.project.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{assigneeName(row.assignee)}</TableCell>
                    <TableCell><TimelineBar row={row} windowStart={windowStart} windowEnd={windowEnd} /></TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {row.estimateHours != null ? `${row.estimateHours}h` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{row.loggedHours}h</TableCell>
                    <TableCell>
                      <Badge className={cn(WITHIN_ESTIMATE_STYLE[row.withinEstimate], 'font-medium')}>
                        {row.withinEstimate === 'WITHIN' ? 'Within' : row.withinEstimate === 'OVER' ? 'Over' : 'Unestimated'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(result?.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-12 text-center text-sm text-muted-foreground">
                      No tasks match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {!error && !loading && result && result.meta.total > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {(result.meta.page - 1) * result.meta.limit + 1}–{Math.min(result.meta.page * result.meta.limit, result.meta.total)} of {result.meta.total}
            </p>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <Button variant="outline" size="sm" className="gap-1" disabled={result.meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft size={14} /> Prev
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-xs font-medium">Page {result.meta.page} of {result.meta.totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <Button variant="outline" size="sm" className="gap-1" disabled={result.meta.page >= result.meta.totalPages} onClick={() => setPage((p) => Math.min(result.meta.totalPages, p + 1))}>
                    Next <ChevronRight size={14} />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
