'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  operationsApi, Leave, LeaveBalance, LeaveTypeMaster, LeaveCalendarEntry, PublicHoliday,
} from '@/lib/operations-api';
import { useAuthStore } from '@/lib/store/auth';
import { formatLeaveDays } from '@/lib/leave-format';
import {
  Palmtree, Plus, AlertCircle, CheckCircle, Clock, XCircle,
  Calendar, BarChart3, RefreshCw, Sun, Sunset, ShieldCheck, Download, Loader2, type LucideIcon,
} from 'lucide-react';

type Tab = 'balances' | 'history' | 'approvals' | 'calendar';

type ApiError = {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
};

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as ApiError).response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

const STATUS_COLORS: Record<string, string> = {
  CL: 'bg-blue-100 text-blue-700',
  SL: 'bg-rose-100 text-rose-700',
  EL: 'bg-emerald-100 text-emerald-700',
  LOP: 'bg-muted text-foreground',
  CO: 'bg-violet-100 text-violet-700',
};

function typeColor(code: string) {
  return STATUS_COLORS[code] ?? 'bg-amber-100 text-amber-700';
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'APPROVED') return <CheckCircle size={14} className="text-emerald-500" />;
  if (status === 'REJECTED') return <XCircle size={14} className="text-red-500" />;
  if (status === 'NOT_REQUIRED') return <CheckCircle size={14} className="text-muted-foreground" />;
  return <Clock size={14} className="text-amber-500" />;
}

function getRequesterName(leave: Leave) {
  const name = [leave.user?.firstName, leave.user?.lastName].filter(Boolean).join(' ').trim();
  return name || leave.user?.email || 'Unknown user';
}


export default function LeavesPage() {
  const { user, hasPermission } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('balances');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [approvalLeaves, setApprovalLeaves] = useState<Leave[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeMaster[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<LeaveCalendarEntry[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Calendar state
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    leaveTypeCode: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDaySession: 'MORNING' as 'MORNING' | 'AFTERNOON',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const userId = user?.id;
  const canViewLeaveApprovals = hasPermission('WORKFORCE_LEAVE_VIEW');
  const canExport = ['ADMIN', 'PM', 'TL'].includes(user?.role ?? '');
  const showApprovalsTab =
    approvalLeaves.length > 0 ||
    hasPermission('WORKFORCE_LEAVE_APPROVE') ||
    ['ADMIN', 'HR', 'PM', 'TL'].includes(user?.role || '');

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const [leavesData, balancesData, typesData, approvalsData] = await Promise.all([
        operationsApi.getLeaves(userId),
        operationsApi.getLeaveBalances(userId),
        operationsApi.getLeaveTypes(),
        canViewLeaveApprovals
          ? operationsApi.getPendingLeaveApprovals().catch(() => [])
          : Promise.resolve([]),
      ]);
      setLeaves(leavesData);
      setApprovalLeaves(approvalsData);
      setBalances(balancesData);
      // Keep every type, not just active ones: historical leaves whose type was
      // later deactivated must still resolve a display name.
      setLeaveTypes(typesData);
      setForm(f => {
        if (f.leaveTypeCode !== '') return f;
        const firstActive = typesData.find(t => t.isActive);
        return firstActive ? { ...f, leaveTypeCode: firstActive.code } : f;
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load leave data'));
    } finally {
      setLoading(false);
    }
  }, [userId, canViewLeaveApprovals]);

  const fetchCalendar = useCallback(async () => {
    try {
      const data = await operationsApi.getLeaveCalendar(calMonth, calYear);
      setCalendarEntries(data);
    } catch {
      // non-critical, calendar may be empty
    }
  }, [calMonth, calYear]);

  const fetchHolidays = useCallback(async () => {
    try {
      const data = await operationsApi.getHolidays(calYear);
      setHolidays(data);
    } catch {
      // non-critical
    }
  }, [calYear]);

  useEffect(() => {
    if (!userId) return;

    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [userId, fetchData]);

  useEffect(() => {
    if (activeTab !== 'calendar' || !userId) return;

    const timeoutId = window.setTimeout(() => {
      void fetchCalendar();
      void fetchHolidays();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, userId, fetchCalendar, fetchHolidays]);

  // Only active types can be applied for; leaveTypes keeps all of them for lookup.
  const activeLeaveTypes = useMemo(() => leaveTypes.filter(t => t.isActive), [leaveTypes]);

  const typeName = useCallback(
    (code?: string | null) => leaveTypes.find(t => t.code === code)?.name ?? code ?? '—',
    [leaveTypes],
  );

  const selectedLeaveType = useMemo(
    () => leaveTypes.find(t => t.code === form.leaveTypeCode),
    [leaveTypes, form.leaveTypeCode],
  );

  const selectedBalance = useMemo(
    () => balances.find(b => b.leaveTypeCode === form.leaveTypeCode),
    [balances, form.leaveTypeCode],
  );

  const sandwichWarning = useMemo(() => {
    if (!selectedLeaveType?.requiresSandwichCheck || !form.startDate || !form.endDate) return false;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const dayBefore = new Date(start); dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(end); dayAfter.setDate(dayAfter.getDate() + 1);
    const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
    return isWeekend(dayBefore) || isWeekend(dayAfter);
  }, [selectedLeaveType, form.startDate, form.endDate]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate || !form.leaveTypeCode || !user?.id) return;
    try {
      setIsSubmitting(true);
      setError('');
      await operationsApi.applyLeave({
        userId: user.id,
        leaveTypeCode: form.leaveTypeCode,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        isHalfDay: form.isHalfDay,
        halfDaySession: form.isHalfDay ? form.halfDaySession : undefined,
        reason: form.reason || undefined,
      });
      setIsModalOpen(false);
      setForm({ leaveTypeCode: activeLeaveTypes[0]?.code ?? '', startDate: '', endDate: '', isHalfDay: false, halfDaySession: 'MORNING', reason: '' });
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to apply for leave'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Calendar helpers ─────────────────────────────────────────────────────────

  const handleApproveLeave = async (leave: Leave) => {
    try {
      setProcessingLeaveId(leave.id);
      setError('');
      await operationsApi.approveLeaveRA(leave.id);
      await fetchData();
      if (activeTab === 'calendar') await fetchCalendar();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to approve leave'));
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleRejectLeave = async (leave: Leave) => {
    try {
      setProcessingLeaveId(leave.id);
      setError('');
      await operationsApi.rejectLeave(leave.id);
      await fetchData();
      if (activeTab === 'calendar') await fetchCalendar();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reject leave'));
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const calendarDays = useMemo(() => {
    const days: { date: Date; entries: LeaveCalendarEntry[]; holiday: PublicHoliday | null }[] = [];
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calYear, calMonth - 1, d);
      const entries = calendarEntries.filter(e => {
        const s = new Date(e.startDate);
        const en = new Date(e.endDate);
        return date >= new Date(s.toDateString()) && date <= new Date(en.toDateString());
      });
      const holiday = holidays.find(h => {
        const hDate = new Date(h.date);
        return hDate.getFullYear() === calYear && (hDate.getMonth() + 1) === calMonth && hDate.getDate() === d;
      }) ?? null;
      days.push({ date, entries, holiday });
    }
    return days;
  }, [calMonth, calYear, calendarEntries, holidays]);

  const monthName = new Date(calYear, calMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading leave data...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
            <Palmtree className="text-primary" size={18} />
            My Leaves
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1.5">
            Manage time off and view leave balances.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={14} />
          Apply Leave
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm font-medium">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { id: 'balances', label: 'Balances', icon: BarChart3 },
          { id: 'history', label: 'History', icon: Clock },
          ...(showApprovalsTab
            ? [{
                id: 'approvals' as const,
                label: approvalLeaves.length > 0 ? `Approvals (${approvalLeaves.length})` : 'Approvals',
                icon: ShieldCheck,
              }]
            : []),
          { id: 'calendar', label: 'Team Calendar', icon: Calendar },
        ] as { id: Tab; label: string; icon: LucideIcon }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Balances Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'balances' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map(b => {
            const pct = b.earned + b.carryForward > 0
              ? Math.min(100, (b.used / (b.earned + b.carryForward)) * 100)
              : 0;
            return (
              <div key={b.id} className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded ${typeColor(b.leaveTypeCode)}`}>
                      {b.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary">{formatLeaveDays(b.available)}</p>
                    <p className="text-xs text-muted-foreground font-bold uppercase">available</p>
                  </div>
                </div>

                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs font-black">{formatLeaveDays(b.earned)}</p>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Earned</p>
                  </div>
                  <div>
                    <p className="text-xs font-black">{formatLeaveDays(b.carryForward)}</p>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Carry</p>
                  </div>
                  <div>
                    <p className="text-xs font-black">{formatLeaveDays(b.used)}</p>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Used</p>
                  </div>
                </div>

                {b.expiryDate && (
                  <p className="text-xs text-amber-600 font-semibold">
                    Expires: {new Date(b.expiryDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
          {balances.length === 0 && (
            <div className="col-span-3 text-center p-10 bg-muted/30 rounded-xl border border-dashed">
              <p className="text-muted-foreground text-sm">No leave balances found.</p>
            </div>
          )}
        </div>
      )}

      {/* ── History Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          {canExport && (
            <div className="flex justify-end items-center gap-3 px-4 py-3 border-b bg-muted/30">
              {exportError && (
                <span className="text-xs text-destructive">{exportError}</span>
              )}
              <button
                onClick={async () => {
                  setExporting(true);
                  setExportError(null);
                  try {
                    await operationsApi.exportLeaves();
                  } catch {
                    setExportError('Export failed. Please try again.');
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-black uppercase tracking-widest hover:bg-muted transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {exporting ? 'Exporting…' : 'Export Excel'}
              </button>
            </div>
          )}
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b">
              <tr className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Days</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">RA</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {leaves.map(leave => {
                const start = new Date(leave.startDate).toLocaleDateString();
                const end = new Date(leave.endDate).toLocaleDateString();
                return (
                  <tr key={leave.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-black px-1.5 py-0.5 rounded ${typeColor(leave.leaveTypeCode)}`}>
                        {typeName(leave.leaveTypeCode)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {start} – {end}
                      {leave.isHalfDay && (
                        <span className="ml-1 text-xs font-bold text-blue-600">
                          {leave.halfDaySession === 'MORNING' ? '(AM)' : '(PM)'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {leave.duration}
                      {leave.sandwichDays > 0 && (
                        <span className="ml-1 text-xs text-amber-600 font-bold">+{leave.sandwichDays}sw</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate" title={leave.reason || ''}>
                      {leave.reason || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 font-medium">
                        <StatusIcon status={leave.raStatus} />
                        <span className="text-xs">{leave.raStatus}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded-md text-xs font-black uppercase tracking-tighter ${
                        leave.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        leave.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {leave.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {leaves.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    You haven&apos;t applied for any leaves yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Calendar Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'approvals' && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b">
              <tr className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-2">Resource</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Days</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {approvalLeaves.map(leave => {
                const start = new Date(leave.startDate).toLocaleDateString();
                const end = new Date(leave.endDate).toLocaleDateString();
                const isProcessing = processingLeaveId === leave.id;

                return (
                  <tr key={leave.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">{getRequesterName(leave)}</p>
                      {leave.user?.email && (
                        <p className="text-xs text-muted-foreground">{leave.user.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-black px-1.5 py-0.5 rounded ${typeColor(leave.leaveTypeCode)}`}>
                        {typeName(leave.leaveTypeCode)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {start} - {end}
                      {leave.isHalfDay && (
                        <span className="ml-1 text-xs font-bold text-blue-600">
                          {leave.halfDaySession === 'MORNING' ? '(AM)' : '(PM)'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {leave.duration}
                      {leave.sandwichDays > 0 && (
                        <span className="ml-1 text-xs text-amber-600 font-bold">+{leave.sandwichDays}sw</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={leave.reason || ''}>
                      {leave.reason || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => void handleRejectLeave(leave)}
                          className="px-3 py-1.5 rounded-lg border text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => void handleApproveLeave(leave)}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {isProcessing ? 'Saving...' : 'Approve'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {approvalLeaves.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                    No pending leave approvals for you right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-tight">{monthName}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { const d = new Date(calYear, calMonth - 2); setCalMonth(d.getMonth() + 1); setCalYear(d.getFullYear()); }}
                className="px-2 py-1 rounded border text-xs font-bold hover:bg-muted"
              >
                ‹
              </button>
              <button
                onClick={() => { const d = new Date(calYear, calMonth); setCalMonth(d.getMonth() + 1); setCalYear(d.getFullYear()); }}
                className="px-2 py-1 rounded border text-xs font-bold hover:bg-muted"
              >
                ›
              </button>
              <button onClick={fetchCalendar} className="px-2 py-1 rounded border text-xs font-bold hover:bg-muted">
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">{d}</div>
            ))}
            {/* Leading empty cells */}
            {Array.from({ length: new Date(calYear, calMonth - 1, 1).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {calendarDays.map(({ date, entries, holiday }) => {
              const isToday = date.toDateString() === new Date().toDateString();
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div
                  key={date.getTime()}
                  className={`min-h-[52px] rounded-lg p-1.5 border text-xs ${
                    isToday ? 'border-primary/60 bg-primary/5' :
                    holiday ? 'bg-orange-50 border-orange-100' :
                    isWeekend ? 'bg-muted/30 border-transparent' :
                    'border-transparent hover:border-muted-foreground/20'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-xs font-bold ${isToday ? 'text-primary' : isWeekend ? 'text-muted-foreground' : ''}`}>
                      {date.getDate()}
                    </span>
                    {holiday && (
                      <span className="text-[8px] font-black uppercase text-orange-600 truncate max-w-[40px]" title={holiday.name}>
                        {holiday.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {entries.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        title={`${e.user.firstName} ${e.user.lastName} — ${typeName(e.leaveTypeCode)}`}
                        className={`truncate text-xs font-bold px-1 rounded ${typeColor(e.leaveTypeCode)}`}
                      >
                        {[e.user.firstName, e.user.lastName].filter(Boolean).join(' ')}
                      </div>
                    ))}
                    {entries.length > 2 && (
                      <div className="text-xs text-muted-foreground font-bold">+{entries.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-2">
            {activeLeaveTypes.map(lt => (
              <span key={lt.code} className={`text-xs font-bold px-2 py-0.5 rounded ${typeColor(lt.code)}`}>
                {lt.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Apply Leave Modal ──────────────────────────────────────────────────── */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
          <div className="flex min-h-full items-center justify-center py-8 px-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-muted/20">
              <h2 className="text-base font-bold">Apply for Leave</h2>
            </div>
            <form onSubmit={handleApplyLeave} className="p-6 space-y-4">
              {/* Leave Type */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Leave Type
                </label>
                <select
                  required
                  value={form.leaveTypeCode}
                  onChange={e => setForm({ ...form, leaveTypeCode: e.target.value, isHalfDay: false })}
                  className="w-full flex h-8 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {activeLeaveTypes.map(lt => (
                    <option key={lt.code} value={lt.code}>{lt.name}</option>
                  ))}
                </select>

                {/* Balance preview */}
                {selectedBalance && (
                  <p className="mt-1 text-xs text-muted-foreground font-semibold">
                    Available: <span className="text-primary font-black">{formatLeaveDays(selectedBalance.available)}</span> day(s)
                    {selectedBalance.carryForward > 0 && ` (incl. ${formatLeaveDays(selectedBalance.carryForward)} carried forward)`}
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full flex h-8 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                    disabled={form.isHalfDay}
                    className="w-full flex h-8 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Half-day toggle */}
              {selectedLeaveType?.allowHalfDay && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isHalfDay}
                      onChange={e => {
                        const hd = e.target.checked;
                        setForm({ ...form, isHalfDay: hd, endDate: hd ? form.startDate : form.endDate });
                      }}
                      className="rounded"
                    />
                    <span className="text-xs font-bold">Half Day</span>
                  </label>
                  {form.isHalfDay && (
                    <div className="flex gap-3 pl-6">
                      {(['MORNING', 'AFTERNOON'] as const).map(s => (
                        <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="halfDaySession"
                            value={s}
                            checked={form.halfDaySession === s}
                            onChange={() => setForm({ ...form, halfDaySession: s })}
                          />
                          <span className="text-xs font-medium flex items-center gap-1">
                            {s === 'MORNING' ? <Sun size={12} /> : <Sunset size={12} />}
                            {s === 'MORNING' ? 'Morning' : 'Afternoon'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sandwich warning */}
              {sandwichWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 font-semibold">
                    Weekend days adjacent to this leave period will be counted (sandwich rule).
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="w-full flex min-h-[60px] rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Reason for leave..."
                />
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive p-2 rounded-lg flex items-center gap-2 text-xs font-medium">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setError(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
