'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  operationsApi,
  Attendance,
  AttendanceRegularization,
  RegularizationReason,
  RegularizationStatus,
} from '@/lib/operations-api';
import { useAuthStore } from '@/lib/store/auth';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  LogIn,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Search,
  SlidersHorizontal,
  Home,
  Zap,
  ClipboardEdit,
  CalendarDays,
  Inbox,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { attendanceStatusLabel, titleCase } from '@/lib/attendance-status';

type ActiveTab = 'my' | 'team' | 'regularizations' | 'pending';

interface RegularizeModalState {
  open: boolean;
  attendance: Attendance | null;
}

type ApiError = {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
};

const REASON_LABELS: Record<RegularizationReason, string> = {
  [RegularizationReason.FORGOT_PUNCH]: 'Forgot to Punch',
  [RegularizationReason.SYSTEM_ERROR]: 'System Error',
  [RegularizationReason.FIELD_WORK]: 'Field Work',
  [RegularizationReason.CLIENT_VISIT]: 'Client Visit',
  [RegularizationReason.TRAINING]: 'Training',
  [RegularizationReason.OTHER]: 'Other',
};

/**
 * Status presentation in one place. Each entry ships an icon alongside its
 * colour so state is never carried by colour alone, and every palette has an
 * explicit dark-mode step rather than relying on the light one to cope.
 */
const STATUS_STYLES: Record<string, { chip: string; dot: string; icon: React.ReactNode }> = {
  PRESENT: {
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
    dot: 'bg-emerald-500',
    icon: <CheckCircle2 size={11} />,
  },
  LATE: {
    chip: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
    dot: 'bg-amber-500',
    icon: <AlertTriangle size={11} />,
  },
  HALF_DAY: {
    chip: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/20',
    dot: 'bg-sky-500',
    icon: <Clock size={11} />,
  },
  REGULARIZED: {
    chip: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/20',
    dot: 'bg-violet-500',
    icon: <ClipboardEdit size={11} />,
  },
  ABSENT: {
    chip: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
    dot: 'bg-red-500',
    icon: <XCircle size={11} />,
  },
};

const FALLBACK_STATUS_STYLE = {
  chip: 'bg-muted text-muted-foreground ring-border',
  dot: 'bg-muted-foreground',
  icon: <Clock size={11} />,
};

const REG_STATUS_STYLES: Record<string, { chip: string; icon: React.ReactNode }> = {
  [RegularizationStatus.APPROVED]: {
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
    icon: <CheckCircle2 size={11} />,
  },
  [RegularizationStatus.REJECTED]: {
    chip: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
    icon: <XCircle size={11} />,
  },
  [RegularizationStatus.PENDING]: {
    chip: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
    icon: <Clock size={11} />,
  },
};

/** Rows per page. The API returns a whole month at a time, so paging is client-side. */
const PAGE_SIZE = 7;

const ATTENDANCE_STATUS_OPTIONS = ['PRESENT', 'LATE', 'HALF_DAY', 'REGULARIZED', 'ABSENT'];
const REG_STATUS_OPTIONS = [
  RegularizationStatus.PENDING,
  RegularizationStatus.APPROVED,
  RegularizationStatus.REJECTED,
];

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as ApiError).response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function toDateTimeLocalValue(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoFromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

/** Local `YYYY-MM-DD` — deliberately not toISOString, which shifts across the date line. */
function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** "2h 14m" for the live since-check-in counter. */
function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AttendancePage() {
  const { user, hasPermission } = useAuthStore();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [myHistory, setMyHistory] = useState<Attendance[]>([]);
  const [teamAttendance, setTeamAttendance] = useState<Attendance[]>([]);
  const [myRegularizations, setMyRegularizations] = useState<AttendanceRegularization[]>([]);
  const [pendingRegularizations, setPendingRegularizations] = useState<AttendanceRegularization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('my');
  const [remarks, setRemarks] = useState('');
  const [isWfh, setIsWfh] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Month being viewed. Drives both the summary and every month-scoped list.
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));

  // Toolbar state.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [regStatusFilter, setRegStatusFilter] = useState<string[]>([]);
  const [reasonFilter, setReasonFilter] = useState<string[]>([]);
  const [wfhOnly, setWfhOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const filterRef = useRef<HTMLDivElement>(null);

  const [regModal, setRegModal] = useState<RegularizeModalState>({ open: false, attendance: null });
  const [regForm, setRegForm] = useState({
    requestedIn: '',
    requestedOut: '',
    reason: RegularizationReason.FORGOT_PUNCH,
    remarks: '',
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  const [now, setNow] = useState(() => Date.now());

  const monthRange = useMemo(() => {
    const start = monthAnchor;
    const end = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
    return { startDate: toYmd(start), endDate: toYmd(end) };
  }, [monthAnchor]);

  const isCurrentMonth = useMemo(() => {
    const today = startOfMonth(new Date());
    return monthAnchor.getTime() === today.getTime();
  }, [monthAnchor]);

  const fetchTodayStatus = useCallback(async () => {
    try {
      const data = await operationsApi.getTodayAttendance(getBrowserTimeZone());
      setTodayAttendance(data);
    } catch { }
  }, []);

  const fetchMyHistory = useCallback(async () => {
    try {
      const data = await operationsApi.getMyAttendance({
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
        timeZone: getBrowserTimeZone(),
      });
      setMyHistory(data);
    } catch { console.error('Failed to fetch my history'); }
  }, [monthRange]);

  const fetchTeamAttendance = useCallback(async () => {
    if (!hasPermission('ATTENDANCE_MANAGE')) return;
    try {
      const data = await operationsApi.getTeamAttendance({
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
        timeZone: getBrowserTimeZone(),
      });
      setTeamAttendance(data);
    } catch { console.error('Failed to fetch team attendance'); }
  }, [hasPermission, monthRange]);

  const fetchMyRegularizations = useCallback(async () => {
    try {
      const data = await operationsApi.getMyRegularizations({
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
      });
      setMyRegularizations(data);
    } catch { console.error('Failed to fetch regularizations'); }
  }, [monthRange]);

  // Deliberately not month-scoped: an approver's queue must surface every
  // outstanding request, including ones filed against an earlier month.
  const fetchPendingRegularizations = useCallback(async () => {
    if (!hasPermission('ATTENDANCE_REGULARIZE_APPROVE')) return;
    try {
      const data = await operationsApi.getPendingRegularizations();
      setPendingRegularizations(data);
    } catch { console.error('Failed to fetch pending regularizations'); }
  }, [hasPermission]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    await Promise.all([
      fetchTodayStatus(),
      fetchMyHistory(),
      fetchTeamAttendance(),
      fetchMyRegularizations(),
      fetchPendingRegularizations(),
    ]);
    setLoading(false);
  }, [fetchTodayStatus, fetchMyHistory, fetchTeamAttendance, fetchMyRegularizations, fetchPendingRegularizations]);

  useEffect(() => {
    if (!user?.id) return;

    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    const handler = () => { void fetchTodayStatus(); };
    window.addEventListener('attendance-updated', handler);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('attendance-updated', handler);
    };
  }, [user, fetchData, fetchTodayStatus]);

  // Ticks the "on the clock for Xh Ym" readout while a shift is open.
  useEffect(() => {
    if (!todayAttendance?.checkIn || todayAttendance?.checkOut) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [todayAttendance?.checkIn, todayAttendance?.checkOut]);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterOpen]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter([]);
    setRegStatusFilter([]);
    setReasonFilter([]);
    setWfhOnly(false);
  }, []);

  // Filters are per-tab by nature; carrying them across tabs just yields
  // confusing empty tables.
  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setFilterOpen(false);
    clearFilters();
  };

  const handleCheckIn = async () => {
    try {
      setIsActionLoading(true);
      setError('');
      await operationsApi.checkIn({ remarks, isWfh, timeZone: getBrowserTimeZone() });
      setRemarks('');
      setIsWfh(false);
      await fetchData();
      window.dispatchEvent(new CustomEvent('attendance-updated'));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to check in'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setIsActionLoading(true);
      setError('');
      await operationsApi.checkOut({ remarks, timeZone: getBrowserTimeZone() });
      setRemarks('');
      await fetchData();
      window.dispatchEvent(new CustomEvent('attendance-updated'));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to check out'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const openRegModal = (attendance: Attendance) => {
    setRegForm({
      requestedIn: toDateTimeLocalValue(attendance.checkIn),
      requestedOut: toDateTimeLocalValue(attendance.checkOut),
      reason: RegularizationReason.FORGOT_PUNCH,
      remarks: '',
    });
    setRegError('');
    setRegModal({ open: true, attendance });
  };

  const handleRegularize = async () => {
    if (!regModal.attendance) return;
    try {
      setRegLoading(true);
      setRegError('');
      await operationsApi.createRegularization({
        date: regModal.attendance.date,
        // Virtual absent entries have a synthetic id — pass undefined so the
        // backend resolves the record by date instead of a non-existent DB id.
        attendanceId: regModal.attendance.id.startsWith('absent-')
          ? undefined
          : regModal.attendance.id,
        requestedIn: toIsoFromDateTimeLocal(regForm.requestedIn),
        requestedOut: toIsoFromDateTimeLocal(regForm.requestedOut),
        reason: regForm.reason,
        remarks: regForm.remarks || undefined,
        timeZone: getBrowserTimeZone(),
      });
      setRegModal({ open: false, attendance: null });
      await fetchData();
    } catch (err: unknown) {
      setRegError(getErrorMessage(err, 'Failed to submit regularization'));
    } finally {
      setRegLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setIsActionLoading(true);
      await operationsApi.approveRegularization(id);
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to approve'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setIsActionLoading(true);
      await operationsApi.rejectRegularization(id);
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reject'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const formatShortDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const userLabel = (u?: { firstName: string; lastName: string; department?: { name: string } | null }) =>
    u ? `${u.firstName} ${u.lastName} ${u.department?.name ?? ''}` : '';

  // ——— Derived data ———

  const presentDays = myHistory.filter(h => h.status === 'PRESENT' || h.status === 'LATE' || h.status === 'REGULARIZED').length;
  const wfhDays = myHistory.filter(h => h.isWfh).length;
  const lateDays = myHistory.filter(h => h.status === 'LATE').length;
  const absentDays = myHistory.filter(h => h.status === 'ABSENT').length;
  const totalOvertimeHours = myHistory.reduce((sum, h) => sum + (h.overtimeHours ?? 0), 0);
  const loggedDays = myHistory.length;
  const presenceRate = loggedDays > 0 ? Math.round((presentDays / loggedDays) * 100) : 0;

  const regByDate = useMemo(
    () => Object.fromEntries(myRegularizations.map(r => [r.date.split('T')[0], r])),
    [myRegularizations],
  );

  const query = search.trim().toLowerCase();

  const matchesAttendance = useCallback(
    (h: Attendance) => {
      if (statusFilter.length > 0 && !statusFilter.includes(h.status)) return false;
      if (wfhOnly && !h.isWfh) return false;
      if (!query) return true;
      const haystack = [
        formatDate(h.date),
        attendanceStatusLabel(h.status),
        h.remarks ?? '',
        h.isWfh ? 'wfh work from home' : '',
        userLabel(h.user),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    },
    [statusFilter, wfhOnly, query],
  );

  const matchesRegularization = useCallback(
    (r: AttendanceRegularization) => {
      if (regStatusFilter.length > 0 && !regStatusFilter.includes(r.status)) return false;
      if (reasonFilter.length > 0 && !reasonFilter.includes(r.reason)) return false;
      if (!query) return true;
      const haystack = [
        formatDate(r.date),
        titleCase(r.status),
        REASON_LABELS[r.reason],
        r.remarks ?? '',
        userLabel(r.user),
        r.approver ? `${r.approver.firstName} ${r.approver.lastName}` : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    },
    [regStatusFilter, reasonFilter, query],
  );

  const filteredHistory = useMemo(() => myHistory.filter(matchesAttendance), [myHistory, matchesAttendance]);
  const filteredTeam = useMemo(() => teamAttendance.filter(matchesAttendance), [teamAttendance, matchesAttendance]);
  const filteredRegs = useMemo(() => myRegularizations.filter(matchesRegularization), [myRegularizations, matchesRegularization]);
  const filteredPending = useMemo(() => pendingRegularizations.filter(matchesRegularization), [pendingRegularizations, matchesRegularization]);

  const isRegTab = activeTab === 'regularizations' || activeTab === 'pending';
  const activeFilterCount =
    (isRegTab ? regStatusFilter.length + reasonFilter.length : statusFilter.length + (wfhOnly ? 1 : 0));
  const hasActiveQuery = activeFilterCount > 0 || query.length > 0;

  const { rowsShown, rowsTotal } = useMemo(() => {
    switch (activeTab) {
      case 'my': return { rowsShown: filteredHistory.length, rowsTotal: myHistory.length };
      case 'team': return { rowsShown: filteredTeam.length, rowsTotal: teamAttendance.length };
      case 'regularizations': return { rowsShown: filteredRegs.length, rowsTotal: myRegularizations.length };
      default: return { rowsShown: filteredPending.length, rowsTotal: pendingRegularizations.length };
    }
  }, [activeTab, filteredHistory, myHistory, filteredTeam, teamAttendance, filteredRegs, myRegularizations, filteredPending, pendingRegularizations]);

  // Anything that changes which rows exist sends you back to the first page —
  // otherwise you can land on a page that no longer has anything on it. Adjusted
  // during render rather than in an effect so it lands in the same commit as the
  // narrowed list, with no intermediate paint on a stale page.
  const rowsKey = [
    activeTab,
    query,
    statusFilter.join(','),
    regStatusFilter.join(','),
    reasonFilter.join(','),
    String(wfhOnly),
    monthRange.startDate,
  ].join('|');
  const [prevRowsKey, setPrevRowsKey] = useState(rowsKey);
  if (rowsKey !== prevRowsKey) {
    setPrevRowsKey(rowsKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(rowsShown / PAGE_SIZE));
  // Guards the render between a filter narrowing the list and the effect above
  // firing, when `page` can briefly point past the end.
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;

  const paginate = useCallback(
    <T,>(rows: T[]) => rows.slice(pageStart, pageStart + PAGE_SIZE),
    [pageStart],
  );

  const pagedHistory = useMemo(() => paginate(filteredHistory), [paginate, filteredHistory]);
  const pagedTeam = useMemo(() => paginate(filteredTeam), [paginate, filteredTeam]);
  const pagedRegs = useMemo(() => paginate(filteredRegs), [paginate, filteredRegs]);
  const pagedPending = useMemo(() => paginate(filteredPending), [paginate, filteredPending]);

  const monthLabel = monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const elapsed =
    todayAttendance?.checkIn && !todayAttendance?.checkOut
      ? formatDuration(now - new Date(todayAttendance.checkIn).getTime())
      : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary/40" />
        <p className="text-xs text-muted-foreground">Loading attendance data…</p>
      </div>
    );
  }

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) =>
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  return (
    <div className="space-y-4 lg:h-[calc(100vh-7rem)] lg:flex lg:flex-col">
      {/* ——— Header ——— */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">Attendance</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Clock size={12} /> Workforce presence tracking
            </p>
          </div>
        </div>

        {/* Month navigator — scopes the summary and every month-based list. */}
        <div className="flex items-center gap-1 self-start sm:self-auto">
          <button
            onClick={() => setMonthAnchor(m => addMonths(m, -1))}
            aria-label="Previous month"
            className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="px-3 py-1.5 min-w-[9.5rem] text-center">
            <span className="text-sm font-medium text-foreground flex items-center justify-center gap-1.5">
              <CalendarDays size={13} className="text-muted-foreground" />
              {monthLabel}
            </span>
          </div>
          <button
            onClick={() => setMonthAnchor(m => addMonths(m, 1))}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
          >
            <ChevronRight size={15} />
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => setMonthAnchor(startOfMonth(new Date()))}
              className="ml-1 px-2.5 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-xs">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:flex-1 lg:min-h-0">
        {/* ——— Left column ——— */}
        <div className="lg:col-span-4 space-y-3 lg:overflow-y-auto lg:min-h-0 lg:pr-0.5">
          {/* Today's presence */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Today&apos;s Presence</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(new Date().toISOString())}</p>
              </div>
              {elapsed && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-600/20 dark:ring-emerald-400/20 px-2 py-1 rounded-full">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  {elapsed}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
                  <LogIn size={10} /> Check In
                </p>
                <p className={cn('text-lg font-semibold tabular-nums tracking-tight leading-tight',
                  todayAttendance?.checkIn ? 'text-foreground' : 'text-muted-foreground/40')}>
                  {formatTime(todayAttendance?.checkIn ?? null)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
                  <LogOut size={10} /> Check Out
                </p>
                <p className={cn('text-lg font-semibold tabular-nums tracking-tight leading-tight',
                  todayAttendance?.checkOut ? 'text-foreground' : 'text-muted-foreground/40')}>
                  {formatTime(todayAttendance?.checkOut ?? null)}
                </p>
              </div>
            </div>

            {todayAttendance?.isWfh && (
              <div className="flex items-center gap-1.5 mb-3 bg-sky-50 dark:bg-sky-500/10 ring-1 ring-sky-600/20 dark:ring-sky-400/20 rounded-md px-2.5 py-1.5">
                <Home size={12} className="text-sky-600 dark:text-sky-400" />
                <span className="text-xs text-sky-700 dark:text-sky-400">Working from home</span>
              </div>
            )}

            {!todayAttendance?.checkOut ? (
              <div className="space-y-3">
                <textarea
                  placeholder="Optional remarks…"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-background border border-border rounded-md p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all min-h-[56px] placeholder:text-muted-foreground/60 resize-none"
                />

                {!todayAttendance && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isWfh}
                    onClick={() => setIsWfh(v => !v)}
                    className="flex items-center gap-2 select-none w-full"
                  >
                    <span
                      className={cn(
                        'w-8 h-4 rounded-full transition-colors flex items-center px-0.5 shrink-0',
                        isWfh ? 'bg-sky-500' : 'bg-muted-foreground/30',
                      )}
                    >
                      <span className={cn('w-3 h-3 rounded-full bg-white shadow transition-transform', isWfh ? 'translate-x-4' : 'translate-x-0')} />
                    </span>
                    <span className="text-xs text-muted-foreground">Work from home</span>
                  </button>
                )}

                {!todayAttendance ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={isActionLoading}
                    className="w-full bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn size={15} />}
                    Check In
                  </button>
                ) : (
                  <button
                    onClick={handleCheckOut}
                    disabled={isActionLoading}
                    className="w-full bg-emerald-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut size={15} />}
                    Check Out
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-600/20 dark:ring-emerald-400/20 px-3 py-2.5 rounded-lg flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 leading-tight">Attendance completed</p>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">Have a great evening!</p>
                </div>
              </div>
            )}
          </div>

          {/* Month summary */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Month Summary</h3>
              <span className="text-xs text-muted-foreground">{monthLabel}</span>
            </div>

            {/* Presence rate meter */}
            <div className="mb-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Presence rate</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{presenceRate}%</span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={presenceRate}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Presence rate"
              >
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${presenceRate}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {presentDays} of {loggedDays} logged {loggedDays === 1 ? 'day' : 'days'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Days Present" value={presentDays} tone="emerald" icon={<CheckCircle2 size={12} />} />
              <StatTile label="WFH Days" value={wfhDays} tone="sky" icon={<Home size={12} />} />
              <StatTile label="Late Arrivals" value={lateDays} tone="amber" icon={<AlertTriangle size={12} />} />
              <StatTile label="Check-in Missing" value={absentDays} tone="red" icon={<XCircle size={12} />} />
            </div>

            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Zap size={12} className="text-violet-500" /> Overtime
              </span>
              <span className="text-sm font-semibold text-foreground tabular-nums">{totalOvertimeHours.toFixed(1)}h</span>
            </div>
          </div>
        </div>

        {/* ——— Main content ——— */}
        <div className="lg:col-span-8 min-h-0">
          {/* No overflow-hidden here: it would clip the filter popover. The
              footer carries its own bottom rounding instead. */}
          <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col lg:h-full">
            {/* Tabs + toolbar */}
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div className="flex gap-1 flex-wrap">
                <TabButton label="My Logs" active={activeTab === 'my'} onClick={() => switchTab('my')} />
                <TabButton label="Regularizations" active={activeTab === 'regularizations'} onClick={() => switchTab('regularizations')} />
                {hasPermission('ATTENDANCE_MANAGE') && (
                  <TabButton label="Team" active={activeTab === 'team'} onClick={() => switchTab('team')} />
                )}
                {hasPermission('ATTENDANCE_REGULARIZE_APPROVE') && (
                  <TabButton
                    label="Pending"
                    count={pendingRegularizations.length}
                    active={activeTab === 'pending'}
                    onClick={() => switchTab('pending')}
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    aria-label="Search records"
                    className="h-8 w-36 sm:w-52 rounded-md border border-border bg-background pl-8 pr-7 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="relative" ref={filterRef}>
                  <button
                    onClick={() => setFilterOpen(o => !o)}
                    aria-expanded={filterOpen}
                    aria-haspopup="true"
                    className={cn(
                      'h-8 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors',
                      activeFilterCount > 0 || filterOpen
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <SlidersHorizontal size={13} />
                    <span className="hidden sm:inline">Filter</span>
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center tabular-nums">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {filterOpen && (
                    <div className="absolute right-0 mt-1.5 w-60 rounded-lg border border-border bg-card shadow-xl z-[60] p-3 space-y-3 max-h-[70vh] overflow-y-auto">
                      {isRegTab ? (
                        <>
                          <FilterGroup title="Request status">
                            {REG_STATUS_OPTIONS.map(s => (
                              <FilterCheck
                                key={s}
                                label={titleCase(s)}
                                checked={regStatusFilter.includes(s)}
                                onChange={() => toggle(regStatusFilter, s, setRegStatusFilter)}
                              />
                            ))}
                          </FilterGroup>
                          <FilterGroup title="Reason">
                            {Object.entries(REASON_LABELS).map(([value, label]) => (
                              <FilterCheck
                                key={value}
                                label={label}
                                checked={reasonFilter.includes(value)}
                                onChange={() => toggle(reasonFilter, value, setReasonFilter)}
                              />
                            ))}
                          </FilterGroup>
                        </>
                      ) : (
                        <>
                          <FilterGroup title="Status">
                            {ATTENDANCE_STATUS_OPTIONS.map(s => (
                              <FilterCheck
                                key={s}
                                label={attendanceStatusLabel(s)}
                                dot={(STATUS_STYLES[s] ?? FALLBACK_STATUS_STYLE).dot}
                                checked={statusFilter.includes(s)}
                                onChange={() => toggle(statusFilter, s, setStatusFilter)}
                              />
                            ))}
                          </FilterGroup>
                          <FilterGroup title="Location">
                            <FilterCheck label="Work from home only" checked={wfhOnly} onChange={() => setWfhOnly(v => !v)} />
                          </FilterGroup>
                        </>
                      )}

                      <div className="pt-1 border-t border-border flex justify-between items-center">
                        <button
                          onClick={clearFilters}
                          disabled={!hasActiveQuery}
                          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground transition-colors"
                        >
                          Clear all
                        </button>
                        <button
                          onClick={() => setFilterOpen(false)}
                          className="text-xs font-medium text-primary hover:opacity-80 transition-opacity"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* My Logs */}
            {activeTab === 'my' && (
              <TableShell
                headers={['Date', 'In', 'Out', 'Status', 'OT', 'Remarks', '']}
                hiddenAt={{ 4: 'sm', 5: 'md' }}
                centered={[3, 4]}
              >
                {pagedHistory.map((h) => {
                  const dateKey = h.date.split('T')[0];
                  const existingReg = regByDate[dateKey];
                  return (
                    <tr key={h.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground whitespace-nowrap">{formatShortDate(h.date)}</span>
                          {h.isWfh && (
                            <span className="flex items-center gap-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              <Home size={9} /> WFH
                            </span>
                          )}
                        </div>
                      </td>
                      <TimeCell value={formatTime(h.checkIn)} filled={!!h.checkIn} />
                      <TimeCell value={formatTime(h.checkOut)} filled={!!h.checkOut} />
                      <td className="px-3 py-2.5 text-center"><StatusPill status={h.status} /></td>
                      <td className="hidden sm:table-cell px-3 py-2.5 text-center">
                        {(h.overtimeHours ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-foreground tabular-nums">
                            <Zap size={10} className="text-violet-500" />{h.overtimeHours.toFixed(1)}h
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-3 py-2.5">
                        <div className="text-xs text-muted-foreground max-w-[140px] truncate" title={h.remarks || undefined}>
                          {h.remarks || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {existingReg ? (
                          <RegStatusPill status={existingReg.status} />
                        ) : (
                          <button
                            onClick={() => openRegModal(h)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border hover:bg-muted px-2 py-1 rounded-md whitespace-nowrap"
                          >
                            <ClipboardEdit size={11} /> Regularize
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredHistory.length === 0 && (
                  <EmptyRow
                    colSpan={7}
                    filtered={hasActiveQuery}
                    onClear={clearFilters}
                    message={`No presence logs for ${monthLabel}.`}
                  />
                )}
              </TableShell>
            )}

            {/* My Regularizations */}
            {activeTab === 'regularizations' && (
              <TableShell
                headers={['Date', 'Req. In', 'Req. Out', 'Reason', 'Status', 'Approver']}
                hiddenAt={{ 2: 'sm', 3: 'md', 5: 'md' }}
                centered={[4]}
              >
                {pagedRegs.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground whitespace-nowrap">{formatShortDate(r.date)}</td>
                    <TimeCell value={formatTime(r.requestedIn)} filled={!!r.requestedIn} />
                    <td className="hidden sm:table-cell px-3 py-2.5 text-xs text-muted-foreground tabular-nums">{formatTime(r.requestedOut)}</td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-xs text-muted-foreground">{REASON_LABELS[r.reason]}</td>
                    <td className="px-3 py-2.5 text-center"><RegStatusPill status={r.status} /></td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-xs text-muted-foreground">
                      {r.approver ? `${r.approver.firstName} ${r.approver.lastName}` : '—'}
                    </td>
                  </tr>
                ))}
                {filteredRegs.length === 0 && (
                  <EmptyRow
                    colSpan={6}
                    filtered={hasActiveQuery}
                    onClear={clearFilters}
                    message={`No regularization requests for ${monthLabel}.`}
                  />
                )}
              </TableShell>
            )}

            {/* Team */}
            {activeTab === 'team' && (
              <TableShell
                headers={['Date', 'Resource', 'In', 'Out', 'Status', 'OT']}
                hiddenAt={{ 5: 'sm' }}
                centered={[4, 5]}
              >
                {pagedTeam.map((h) => (
                  <tr key={h.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground whitespace-nowrap">{formatShortDate(h.date)}</td>
                    <td className="px-3 py-2.5">
                      <PersonCell user={h.user} />
                    </td>
                    <TimeCell value={formatTime(h.checkIn)} filled={!!h.checkIn} />
                    <TimeCell value={formatTime(h.checkOut)} filled={!!h.checkOut} />
                    <td className="px-3 py-2.5 text-center"><StatusPill status={h.status} /></td>
                    <td className="hidden sm:table-cell px-3 py-2.5 text-center">
                      {(h.overtimeHours ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-foreground tabular-nums">
                          <Zap size={10} className="text-violet-500" />{h.overtimeHours.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredTeam.length === 0 && (
                  <EmptyRow
                    colSpan={6}
                    filtered={hasActiveQuery}
                    onClear={clearFilters}
                    message={`No team presence logs for ${monthLabel}.`}
                  />
                )}
              </TableShell>
            )}

            {/* Pending approvals */}
            {activeTab === 'pending' && (
              <TableShell
                headers={['Employee', 'Date', 'Req. In', 'Req. Out', 'Reason', 'Actions']}
                hiddenAt={{ 3: 'sm', 4: 'md' }}
              >
                {pagedPending.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5"><PersonCell user={r.user} /></td>
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground whitespace-nowrap">{formatShortDate(r.date)}</td>
                    <TimeCell value={formatTime(r.requestedIn)} filled={!!r.requestedIn} />
                    <td className="hidden sm:table-cell px-3 py-2.5 text-xs text-muted-foreground tabular-nums">{formatTime(r.requestedOut)}</td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-xs text-muted-foreground">{REASON_LABELS[r.reason]}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={isActionLoading}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(r.id)}
                          disabled={isActionLoading}
                          className="border border-border hover:bg-muted text-foreground text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPending.length === 0 && (
                  <EmptyRow
                    colSpan={6}
                    filtered={hasActiveQuery}
                    onClear={clearFilters}
                    message="No pending regularization requests."
                  />
                )}
              </TableShell>
            )}

            <div className="px-3 py-2.5 bg-muted/30 border-t border-border rounded-b-xl flex items-center justify-between gap-3 flex-wrap shrink-0">
              <p className="text-xs text-muted-foreground">
                {rowsShown === 0
                  ? 'No records'
                  : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, rowsShown)} of ${rowsShown}`}
                {hasActiveQuery && rowsShown !== rowsTotal && ` (filtered from ${rowsTotal})`}
                {activeTab !== 'pending' && ` · ${monthLabel}`}
              </p>

              <div className="flex items-center gap-3">
                {hasActiveQuery && (
                  <button
                    onClick={clearFilters}
                    className="text-xs font-medium text-primary hover:opacity-80 transition-opacity"
                  >
                    Clear filters
                  </button>
                )}
                {pageCount > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      aria-label="Previous page"
                      className="p-1.5 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums px-1.5" aria-live="polite">
                      {safePage} / {pageCount}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                      disabled={safePage === pageCount}
                      aria-label="Next page"
                      className="p-1.5 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regularization modal */}
      {regModal.open && regModal.attendance && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setRegModal({ open: false, attendance: null })}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Regularize Attendance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(regModal.attendance.date)}</p>
              </div>
              <button
                onClick={() => setRegModal({ open: false, attendance: null })}
                aria-label="Close"
                className="p-1.5 hover:bg-muted rounded text-muted-foreground"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-muted/50 border border-border rounded-lg p-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Current Check-In</p>
                  <p className="text-sm font-medium text-foreground tabular-nums">{formatTime(regModal.attendance.checkIn)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Current Check-Out</p>
                  <p className="text-sm font-medium text-foreground tabular-nums">{formatTime(regModal.attendance.checkOut)}</p>
                </div>
              </div>

              {regError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2.5 rounded text-red-700 dark:text-red-400 text-xs flex items-center gap-1.5">
                  <AlertCircle size={13} />{regError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Requested Check-In</label>
                  <input
                    type="datetime-local"
                    value={regForm.requestedIn}
                    onChange={(e) => setRegForm(f => ({ ...f, requestedIn: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="form-label">Requested Check-Out</label>
                  <input
                    type="datetime-local"
                    value={regForm.requestedOut}
                    onChange={(e) => setRegForm(f => ({ ...f, requestedOut: e.target.value }))}
                    className="field-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Reason</label>
                <select
                  value={regForm.reason}
                  onChange={(e) => setRegForm(f => ({ ...f, reason: e.target.value as RegularizationReason }))}
                  className="field-select"
                >
                  {Object.entries(REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Additional Remarks</label>
                <textarea
                  placeholder="Optional remarks…"
                  value={regForm.remarks}
                  onChange={(e) => setRegForm(f => ({ ...f, remarks: e.target.value }))}
                  className="field-textarea min-h-[60px] resize-none"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button onClick={() => setRegModal({ open: false, attendance: null })} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleRegularize} disabled={regLoading} className="btn-primary">
                {regLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardEdit size={12} />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ——————————————————— Presentational pieces ——————————————————— */

function TabButton({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center tabular-nums',
            active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? FALLBACK_STATUS_STYLE;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ring-1', style.chip)}>
      {style.icon}
      {attendanceStatusLabel(status)}
    </span>
  );
}

function RegStatusPill({ status }: { status: RegularizationStatus }) {
  const style = REG_STATUS_STYLES[status] ?? FALLBACK_STATUS_STYLE;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ring-1', style.chip)}>
      {style.icon}
      {titleCase(status)}
    </span>
  );
}

const TILE_TONES: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  sky: 'text-sky-600 dark:text-sky-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

/**
 * Value and label wear text tokens; the small icon beside them carries the
 * status colour, so the number stays readable at any contrast setting.
 */
function StatTile({ label, value, tone, icon }: { label: string; value: number; tone: keyof typeof TILE_TONES; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={TILE_TONES[tone]}>{icon}</span>
        <span className="text-[11px] text-muted-foreground leading-none truncate">{label}</span>
      </div>
      <p className="text-base font-semibold text-foreground tabular-nums leading-tight">{value}</p>
    </div>
  );
}

function TimeCell({ value, filled }: { value: string; filled: boolean }) {
  return (
    <td className="px-3 py-2.5">
      <span className={cn('text-xs tabular-nums', filled ? 'text-foreground' : 'text-muted-foreground/40')}>
        {value}
      </span>
    </td>
  );
}

function PersonCell({ user }: { user?: { firstName: string; lastName: string; department?: { name: string } | null } }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
        {user?.firstName?.[0]}{user?.lastName?.[0]}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground truncate">{user?.firstName} {user?.lastName}</div>
        <div className="text-[11px] text-muted-foreground truncate">{user?.department?.name || 'No department'}</div>
      </div>
    </div>
  );
}

/** Shared table chrome so every tab gets the same header treatment and scroll behaviour. */
function TableShell({
  headers,
  children,
  hiddenAt = {},
  centered = [],
}: {
  headers: string[];
  children: React.ReactNode;
  hiddenAt?: Record<number, 'sm' | 'md'>;
  centered?: number[];
}) {
  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted border-b border-border">
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  'px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
                  hiddenAt[i] === 'sm' && 'hidden sm:table-cell',
                  hiddenAt[i] === 'md' && 'hidden md:table-cell',
                  centered.includes(i) && 'text-center',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

/** Distinguishes "nothing here" from "nothing matched", which need different exits. */
function EmptyRow({
  colSpan,
  message,
  filtered,
  onClear,
}: {
  colSpan: number;
  message: string;
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            {filtered ? <Search size={16} /> : <Inbox size={16} />}
          </div>
          <p className="text-xs text-muted-foreground">
            {filtered ? 'No records match your search or filters.' : message}
          </p>
          {filtered && (
            <button onClick={onClear} className="text-xs font-medium text-primary hover:opacity-80 transition-opacity">
              Clear filters
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterCheck({
  label,
  checked,
  onChange,
  dot,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  dot?: string;
}) {
  return (
    <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
      />
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />}
      <span className="text-xs text-foreground">{label}</span>
    </label>
  );
}
