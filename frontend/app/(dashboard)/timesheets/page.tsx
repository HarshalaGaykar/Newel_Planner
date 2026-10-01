'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import axios from 'axios';
import {
  operationsApi, PaginationMeta, TeamSummaryOption, TeamTimesheetSummary, Timesheet,
} from '@/lib/operations-api';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup,
  ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger,
} from '@/components/kibo-ui/combobox';
import {
  Calendar, CalendarDays, Plus, Clock, AlertCircle, ArrowLeft, Eye, UserRound, UsersRound,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import TimesheetCalendar from '@/components/timesheets/TimesheetCalendar';
import { useRouter } from 'next/navigation';
import BulkUploadTimesheetDialog from '@/components/timesheets/BulkUploadTimesheetDialog';
import TimesheetUploadHistoryDialog from '@/components/timesheets/TimesheetUploadHistoryDialog';
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
  type ColumnDef, type PaginationState,
  flexRender, getCoreRowModel, getPaginationRowModel, useReactTable,
} from '@tanstack/react-table';

function getMondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

interface WeekOption {
  value: string;      // Monday as YYYY-MM-DD (also used as the form value)
  label: string;      // e.g. "Jun 29 – Jul 5, 2026"
  search: string;     // lowercased haystack for fuzzy typing (month names, dates)
  isCurrent: boolean;
  isNext: boolean;
}

function fmtYMD(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mondayOf(input: Date) {
  const d = new Date(input);
  const dow = d.getDay(); // 0 = Sunday … 6 = Saturday
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  d.setHours(0, 0, 0, 0);
  return d;
}

// Build the list of weeks a user may create — from next week back to the
// admin-configured past window. Mirrors the backend's assertWithinCreationWindow.
function getSelectableWeeks(allowedPastDays: number): WeekOption[] {
  const today = new Date();
  const currentMonday = mondayOf(today);
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);

  const earliest = new Date(today);
  earliest.setDate(today.getDate() - allowedPastDays);
  const earliestMonday = mondayOf(earliest);

  const fmtLabel = (start: Date, end: Date) => {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  };

  const weeks: WeekOption[] = [];
  const cursor = new Date(nextMonday);
  while (cursor.getTime() >= earliestMonday.getTime()) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    const label = fmtLabel(start, end);
    // Include full month names + ISO value so typing "june", "jun 29" or "06/29" all match.
    const longRange = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    weeks.push({
      value: fmtYMD(start),
      label,
      search: `${label} ${longRange} ${fmtYMD(start)} ${fmtYMD(end)}`.toLowerCase(),
      isCurrent: start.getTime() === currentMonday.getTime(),
      isNext: start.getTime() === nextMonday.getTime(),
    });
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

/** Each state carries an explicit dark step so the badges survive theme switches. */
function getStatusColor(status: string) {
  switch (status) {
    case 'SUBMITTED':
      return 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/20';
    case 'RA_APPROVED':
    case 'TL_APPROVED':
      return 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/20';
    case 'PM_APPROVED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20';
    case 'REJECTED':
      return 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20';
    case 'DRAFT':
    default:
      return 'bg-muted text-muted-foreground ring-border';
  }
}

/** `RA_APPROVED` → `RA Approved`; keeps the role prefixes capitalised. */
function formatStatusLabel(status: string) {
  return status
    .split('_')
    .map(part => (part.length <= 2 ? part : part.charAt(0) + part.slice(1).toLowerCase()))
    .join(' ');
}

// Mirrors the TimesheetStatus enum in schema.prisma.
const TIMESHEET_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'RA_APPROVED', label: 'RA Approved' },
  { value: 'PM_APPROVED', label: 'PM Approved' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

const TEAM_PAGE_SIZE = 6;

const timesheetColumns: ColumnDef<Timesheet>[] = [
  {
    id: 'week',
    header: 'Week',
    cell: ({ row }) => {
      const start = new Date(row.original.startDate).toLocaleDateString();
      const end = new Date(row.original.endDate).toLocaleDateString();
      return (
        <div className="flex items-center gap-2 font-bold">
          <Calendar size={12} className="text-muted-foreground shrink-0" />
          {start} - {end}
        </div>
      );
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${getStatusColor(row.original.status)}`}>
        {formatStatusLabel(row.original.status)}
      </span>
    ),
  },
  {
    id: 'updatedAt',
    header: 'Last Updated',
    cell: ({ row }) => (
      <span className="text-muted-foreground font-medium">
        {new Date(row.original.updatedAt).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <a
        href={`/timesheets/${row.original.id}`}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md flex items-center justify-center transition-colors"
        title="View Details"
      >
        <Eye size={16} />
      </a>
    ),
  },
];

function MyTimesheetsTable({ timesheets }: { timesheets: Timesheet[] }) {
  const tableId = useId();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });

  // Reset to first page when the data set changes
  useEffect(() => {
    setPagination(p => ({ ...p, pageIndex: 0 }));
  }, [timesheets]);

  const table = useReactTable({
    data: timesheets,
    columns: timesheetColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  });

  const total = timesheets.length;
  const { pageIndex, pageSize } = pagination;
  const pageStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} className="bg-muted/50 border-b hover:bg-muted/50">
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="divide-y text-xs">
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                No timesheets found. Create a new one to log your hours.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => (
              <TableRow key={row.id} className="hover:bg-muted/20 transition-colors group">
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination bar — only shown when there is data */}
      {total > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t bg-muted/5">
          <div className="flex items-center gap-2">
            <Label htmlFor={`${tableId}-rpp`} className="text-xs text-muted-foreground whitespace-nowrap">
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={v => setPagination({ pageIndex: 0, pageSize: Number(v) })}
            >
              <SelectTrigger id={`${tableId}-rpp`} className="h-8 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 25, 50].map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-xs text-muted-foreground text-center sm:text-left">
            {pageStart}–{pageEnd} of {total} timesheets
          </span>

          <Pagination className="w-auto justify-end">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronFirst size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  <ChevronRight size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
                  <ChevronLast size={14} />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

export default function TimesheetsPage() {
  const { user, hasPermission } = useAuthStore();
  const [hasMounted, setHasMounted] = useState(false);
  const canViewTeam = hasMounted && hasPermission('WORKFORCE_TEAM_TIMESHEET_VIEW');
  const router = useRouter();
  const userId = user?.id;
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamSummaries, setTeamSummaries] = useState<TeamTimesheetSummary[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState('');

  // Team Timesheets filters + pagination (server-side — 6 cards per page).
  const [teamPage, setTeamPage] = useState(1);
  const [teamMeta, setTeamMeta] = useState<PaginationMeta | null>(null);
  const [teamStatus, setTeamStatus] = useState('ALL');
  const [teamUserId, setTeamUserId] = useState('');
  const [teamOptions, setTeamOptions] = useState<TeamSummaryOption[]>([]);
  const [teamUserOpen, setTeamUserOpen] = useState(false);
  const [teamUserSearch, setTeamUserSearch] = useState('');
  const [allowedPastDays, setAllowedPastDays] = useState(7);
  const selectableWeeks = useMemo(() => getSelectableWeeks(allowedPastDays), [allowedPastDays]);
  const [selfMissingDates, setSelfMissingDates] = useState<string[]>([]);
  const [missingCardDismissed, setMissingCardDismissed] = useState(false);

  // Week combobox: search across the full window, but only render a batch at a
  // time (with "load more") so a large configured window stays light in the DOM.
  const WEEK_PAGE = 8;
  const WEEK_SEARCH_CAP = 50;
  const [weekOpen, setWeekOpen] = useState(false);
  const [weekSearch, setWeekSearch] = useState('');
  const [weekVisible, setWeekVisible] = useState(WEEK_PAGE);

  const weekComboData = useMemo(
    () => selectableWeeks.map(w => ({ value: w.value, label: `Week of ${w.label}` })),
    [selectableWeeks],
  );

  const filteredWeeks = useMemo(() => {
    const q = weekSearch.trim().toLowerCase();
    return q ? selectableWeeks.filter(w => w.search.includes(q)) : selectableWeeks;
  }, [selectableWeeks, weekSearch]);

  const isSearchingWeeks = weekSearch.trim().length > 0;
  const visibleWeeks = isSearchingWeeks
    ? filteredWeeks.slice(0, WEEK_SEARCH_CAP)
    : filteredWeeks.slice(0, weekVisible);
  const canLoadMoreWeeks = !isSearchingWeeks && filteredWeeks.length > weekVisible;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const tsData = await operationsApi.getTimesheets({ userId });
      setTimesheets(tsData);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchTeamSummary = useCallback(async () => {
    try {
      setTeamLoading(true);
      setTeamError('');
      const summary = await operationsApi.getTeamTimesheetSummary({
        page: teamPage,
        limit: TEAM_PAGE_SIZE,
        status: teamStatus === 'ALL' ? undefined : teamStatus,
        userId: teamUserId || undefined,
      });
      setTeamSummaries(summary.data);
      setTeamMeta(summary.meta);
      // If the set shrank under us (data changed, or we were left past the last
      // page), step back so the grid is never stranded empty.
      if (summary.meta.totalPages > 0 && teamPage > summary.meta.totalPages) {
        setTeamPage(summary.meta.totalPages);
      }
    } catch (error: unknown) {
      setTeamError(getErrorMessage(error, 'Failed to load team timesheets'));
    } finally {
      setTeamLoading(false);
    }
  }, [teamPage, teamStatus, teamUserId]);

  const fetchTeamOptions = useCallback(async () => {
    try {
      setTeamOptions(await operationsApi.getTeamSummaryOptions());
    } catch {
      // Non-critical — the status filter still works without the name list.
    }
  }, []);

  const fetchTimesheetSettings = useCallback(async () => {
    try {
      const settings = await operationsApi.getTimesheetSettings();
      const parsed = Number(settings.backdatedDaysLimit);
      if (Number.isFinite(parsed) && parsed >= 0) setAllowedPastDays(parsed);
    } catch {
      // Keep the local fallback if settings cannot be loaded.
    }
  }, []);

  const fetchSelfMissingEntries = useCallback(async () => {
    try {
      const today = new Date();
      const to = new Date(today);
      to.setDate(today.getDate() - 1);
      const from = new Date(today);
      from.setDate(today.getDate() - 30);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const result = await operationsApi.getMissingEntries({ from: fmt(from), to: fmt(to) });
      setSelfMissingDates(result[0]?.missingDates ?? []);
    } catch {
      // Non-critical — silently keep empty on error.
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Fetch timesheet creation window through timesheet permissions, not admin-config permissions.
  useEffect(() => {
    if (!hasMounted) return;
    void fetchTimesheetSettings();
  }, [fetchTimesheetSettings, hasMounted]);

  useEffect(() => {
    if (!hasMounted || !userId) return;
    void fetchSelfMissingEntries();
  }, [fetchSelfMissingEntries, hasMounted, userId]);

  useEffect(() => {
    if (!userId) return;

    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchData, userId]);

  // Kept separate from fetchData so changing a team filter does not refetch
  // "My Timesheets" as well.
  useEffect(() => {
    if (!userId || !canViewTeam) return;

    const timeoutId = window.setTimeout(() => {
      void fetchTeamSummary();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTeamSummary, userId, canViewTeam]);

  useEffect(() => {
    if (!userId || !canViewTeam) return;

    const timeoutId = window.setTimeout(() => {
      void fetchTeamOptions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTeamOptions, userId, canViewTeam]);

  const handleCreateWeekly = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!startDate || !user?.id) return;

    const start = new Date(startDate);
    // Ensure Monday
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(start.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    try {
      setIsSubmitting(true);
      await operationsApi.getOrCreateWeekly({
        userId: user.id,
        startDate: monday.toISOString(),
        endDate: sunday.toISOString(),
      });
      setIsModalOpen(false);
      setStartDate('');
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to create timesheet'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const getLatestWeekLabel = (employee: TeamTimesheetSummary) => {
    const start = formatDate(employee.latestWeekStart);
    const end = formatDate(employee.latestWeekEnd);
    return start && end ? `Latest week: ${start} - ${end}` : 'No submitted weeks yet';
  };

  const openTeamMemberTimesheets = (employee: TeamTimesheetSummary) => {
    router.push(`/timesheets/team/${employee.userId}`);
  };

  // ── Team filters ──────────────────────────────────────────────────────────
  const teamComboData = useMemo(
    () => teamOptions.map(o => ({ value: o.userId, label: o.name })),
    [teamOptions],
  );

  const filteredTeamOptions = useMemo(() => {
    const q = teamUserSearch.trim().toLowerCase();
    if (!q) return teamOptions;
    return teamOptions.filter(
      o => o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q),
    );
  }, [teamOptions, teamUserSearch]);

  const handleTeamStatusChange = (value: string) => {
    setTeamStatus(value);
    setTeamPage(1);
  };

  // cmdk hands back the item's value; match case-insensitively so the lookup
  // holds regardless of how it normalises the string.
  const handleTeamUserChange = (value: string) => {
    const match = teamOptions.find(o => o.userId.toLowerCase() === value.toLowerCase());
    setTeamUserId(prev => (match && match.userId === prev ? '' : match?.userId ?? ''));
    setTeamPage(1);
  };

  const clearTeamFilters = () => {
    setTeamStatus('ALL');
    setTeamUserId('');
    setTeamUserSearch('');
    setTeamPage(1);
  };

  const hasTeamFilters = teamStatus !== 'ALL' || Boolean(teamUserId);
  const teamTotalPages = teamMeta?.totalPages ?? 0;
  const teamTotal = teamMeta?.total ?? 0;
  const teamRangeStart = teamTotal === 0 ? 0 : (teamPage - 1) * TEAM_PAGE_SIZE + 1;
  const teamRangeEnd = Math.min(teamPage * TEAM_PAGE_SIZE, teamTotal);

  const openCreateModal = () => {
    void fetchTimesheetSettings();
    setWeekSearch('');
    setWeekVisible(WEEK_PAGE);
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setStartDate('');
    setWeekSearch('');
    setWeekOpen(false);
  };

  // Default to the current week whenever the dialog opens (or the window changes).
  useEffect(() => {
    if (!isModalOpen || startDate) return;
    const current = selectableWeeks.find(w => w.isCurrent) ?? selectableWeeks[0];
    if (current) setStartDate(current.value);
  }, [isModalOpen, startDate, selectableWeeks]);

  const createModal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b bg-muted/20">
          <h2 className="text-base font-bold">New Weekly Timesheet</h2>
        </div>
        <form onSubmit={handleCreateWeekly} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Select Week</label>
            <Combobox
              data={weekComboData}
              type="week"
              value={startDate}
              onValueChange={setStartDate}
              open={weekOpen}
              onOpenChange={(open) => {
                setWeekOpen(open);
                if (open) setWeekVisible(WEEK_PAGE);
                else setWeekSearch('');
              }}
            >
              <ComboboxTrigger className="w-full h-8 px-3 text-xs font-normal justify-between" />
              <ComboboxContent className="z-[10000] p-0" shouldFilter={false}>
                <ComboboxInput value={weekSearch} onValueChange={setWeekSearch} />
                <ComboboxEmpty>No matching week.</ComboboxEmpty>
                <ComboboxList>
                  <ComboboxGroup>
                    {visibleWeeks.map((w) => (
                      <ComboboxItem key={w.value} value={w.value} className="text-xs">
                        <span className="flex-1">Week of {w.label}</span>
                        {(w.isCurrent || w.isNext) && (
                          <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {w.isCurrent ? 'Current' : 'Next'}
                          </span>
                        )}
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                  {canLoadMoreWeeks && (
                    <button
                      type="button"
                      onClick={() => setWeekVisible((c) => c + WEEK_PAGE)}
                      className="w-full border-t px-2 py-1.5 text-center text-xs font-semibold text-primary hover:bg-muted/50 transition-colors"
                    >
                      Load older weeks
                    </button>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">
              Log time for the current week, next week, or any week within the last <span className="font-bold text-foreground">{allowedPastDays}</span> day{allowedPastDays === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={closeCreateModal}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const teamFilterBar = (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label className="text-[11px] font-mediumr text-muted-foreground">
          Team Member
        </Label>
        <Combobox
          data={teamComboData}
          type="member"
          value={teamUserId}
          onValueChange={handleTeamUserChange}
          open={teamUserOpen}
          onOpenChange={(open) => {
            setTeamUserOpen(open);
            if (!open) setTeamUserSearch('');
          }}
        >
          <ComboboxTrigger className="w-full h-8 px-3 text-xs font-normal justify-between" />
          <ComboboxContent className="p-0" shouldFilter={false}>
            <ComboboxInput value={teamUserSearch} onValueChange={setTeamUserSearch} />
            <ComboboxEmpty>No matching member.</ComboboxEmpty>
            <ComboboxList>
              <ComboboxGroup>
                {filteredTeamOptions.map((option) => (
                  <ComboboxItem key={option.userId} value={option.userId} className="text-xs">
                    <span className="flex-1 truncate">{option.name}</span>
                    <span className="ml-2 truncate text-[10px] text-muted-foreground">{option.email}</span>
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <div className="space-y-1.5 sm:w-44">
        <Label className="text-[11px] font-mediumr text-muted-foreground">
          Status
        </Label>
        <Select value={teamStatus} onValueChange={handleTeamStatusChange}>
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All statuses</SelectItem>
            {TIMESHEET_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasTeamFilters && (
        <Button
          variant="outline"
          onClick={clearTeamFilters}
          className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
        >
          <X size={13} />
          Clear
        </Button>
      )}
    </div>
  );

  const teamPaginationBar = (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground">
        Showing {teamRangeStart}–{teamRangeEnd} of {teamTotal} member{teamTotal === 1 ? '' : 's'}
      </span>

      <Pagination className="w-auto justify-end">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setTeamPage(1)} disabled={teamPage <= 1}>
              <ChevronFirst size={14} />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setTeamPage(p => Math.max(1, p - 1))} disabled={teamPage <= 1}>
              <ChevronLeft size={14} />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <span className="px-2 text-xs font-semibold text-muted-foreground">
              Page {teamPage} of {Math.max(1, teamTotalPages)}
            </span>
          </PaginationItem>
          <PaginationItem>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setTeamPage(p => Math.min(teamTotalPages || 1, p + 1))}
              disabled={teamPage >= teamTotalPages}>
              <ChevronRight size={14} />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setTeamPage(teamTotalPages || 1)} disabled={teamPage >= teamTotalPages}>
              <ChevronLast size={14} />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );

  // Disabled per request — unfilled-dates nudge banner
  const missingDatesCard = false && selfMissingDates.length > 0 && !missingCardDismissed ? (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="text-xs font-bold">
            {selfMissingDates.length} unfilled date{selfMissingDates.length === 1 ? '' : 's'} in the last 30 days — fill them in to stay up to date
          </span>
        </div>
        <button
          onClick={() => setMissingCardDismissed(true)}
          className="shrink-0 text-amber-500 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-300 transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {selfMissingDates.map((d) => (
          <button
            key={d}
            onClick={() => { setStartDate(getMondayOf(d)); setIsModalOpen(true); }}
            className="inline-flex items-center rounded-md border border-amber-300 bg-white dark:bg-amber-950/50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // Shared by every role — previously duplicated across the team / no-team
  // layouts, which meant two copies to keep in step.
  const myTimesheetsPanel = (
    <>
      <div className="flex justify-end gap-2">
        <PermissionGate permission="WORKFORCE_TIMESHEET_BULK_UPLOAD">
          <BulkUploadTimesheetDialog onImported={fetchData} />
          <TimesheetUploadHistoryDialog onRolledBack={fetchData} />
        </PermissionGate>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          New Weekly Timesheet
        </button>
      </div>

      {missingDatesCard}

      {loading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading timesheets...</div>
      ) : (
        <>
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          <MyTimesheetsTable timesheets={timesheets} />
        </>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8 animate-in">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2 leading-tight">
            <Clock className="text-primary" size={18} />
            Timesheets
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track your weekly effort and submit for approval.</p>
        </div>
      </div>

      <Tabs defaultValue="my-timesheets" className="w-full">
        <TabsList shape="pill" className={`grid w-full ${canViewTeam ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="my-timesheets">
            <UserRound />
            My Timesheets
          </TabsTrigger>
          {canViewTeam && (
            <TabsTrigger value="team-timesheets">
              <UsersRound />
              Team Timesheets
            </TabsTrigger>
          )}
          <TabsTrigger value="calendar">
            <CalendarDays />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-timesheets" className="space-y-4 pt-2">
          {myTimesheetsPanel}
        </TabsContent>

        <TabsContent value="calendar" className="pt-2">
          <TimesheetCalendar />
        </TabsContent>

        {canViewTeam && (
          <TabsContent value="team-timesheets" className="pt-2 space-y-4">
            <div className="flex justify-end">
              <Link
                href="/timesheets/missing-entries"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <AlertCircle size={13} />
                View Missing Entries Report
              </Link>
            </div>
            {teamFilterBar}

            {teamLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: TEAM_PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                    <Skeleton className="h-16 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {teamError && (
                  <div className="mb-4 bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm font-medium">
                    <AlertCircle size={18} />
                    {teamError}
                  </div>
                )}

                {teamSummaries.length === 0 && !teamError ? (
                  <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
                    <UsersRound className="mb-3 size-8 text-muted-foreground/60" />
                    <p className="text-sm font-semibold text-foreground">
                      {hasTeamFilters ? 'No members match these filters' : 'No team timesheets found'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hasTeamFilters
                        ? 'Try a different status or team member.'
                        : 'Submitted team timesheets will appear here once available.'}
                    </p>
                    {hasTeamFilters && (
                      <button
                        onClick={clearTeamFilters}
                        className="mt-3 text-xs font-semibold text-primary hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {teamSummaries.map((employee) => (
                      <Card
                        key={employee.userId}
                        role="button"
                        tabIndex={0}
                        className="rounded-lg cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openTeamMemberTimesheets(employee)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openTeamMemberTimesheets(employee);
                          }
                        }}
                      >
                        <CardHeader className="flex flex-row items-center gap-3">
                          <Avatar className="size-12">
                            <AvatarImage src={employee.avatarUrl ?? undefined} alt={employee.name} />
                            <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="truncate text-sm font-semibold">{employee.name}</CardTitle>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="size-3" />
                              {getLatestWeekLabel(employee)}
                            </p>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 divide-x divide-border rounded-md bg-muted p-3">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">Total Hours (Week)</div>
                              <div className="mt-1 text-xl font-bold">{employee.latestWeekHours}h</div>
                            </div>
                            <div className="pl-3 text-right">
                              <div className="text-xs font-medium text-muted-foreground">Total Hours (Month)</div>
                              <div className="mt-1 text-xl font-bold">{employee.monthHours}h</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded bg-secondary/50 p-2">
                              <div className="text-xs text-muted-foreground">Pending</div>
                              <div className="text-base font-semibold">{employee.pendingTimesheets}</div>
                            </div>
                            <div className="rounded bg-green-500/10 p-2">
                              <div className="text-xs text-muted-foreground">Approved</div>
                              <div className="text-base font-semibold text-green-600">{employee.approvedTimesheets}</div>
                            </div>
                            <div className="rounded bg-destructive/10 p-2">
                              <div className="text-xs text-muted-foreground">Rejected</div>
                              <div className="text-base font-semibold text-destructive">{employee.rejectedTimesheets}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {teamTotal > 0 && teamPaginationBar}
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      {isModalOpen && createModal}
    </div>
  );
}
