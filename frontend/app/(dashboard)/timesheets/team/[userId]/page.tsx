'use client';

import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { operationsApi, Timesheet, TimesheetStatus } from '@/lib/operations-api';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, Clock, Eye, Filter, UserRound, XCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

const submittedOrApprovedStatuses = new Set<string>([
  TimesheetStatus.SUBMITTED,
  TimesheetStatus.RA_APPROVED,
  TimesheetStatus.PM_APPROVED,
]);

const historyStatuses = new Set<string>([
  TimesheetStatus.SUBMITTED,
  TimesheetStatus.RA_APPROVED,
  TimesheetStatus.PM_APPROVED,
  TimesheetStatus.REJECTED,
]);

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
}

function getStatusColor(status: string) {
  switch (status) {
    case TimesheetStatus.SUBMITTED:
      return 'bg-blue-100 text-blue-700';
    case TimesheetStatus.RA_APPROVED:
    case TimesheetStatus.TL_APPROVED:
      return 'bg-purple-100 text-purple-700';
    case TimesheetStatus.PM_APPROVED:
      return 'bg-emerald-100 text-emerald-700';
    case TimesheetStatus.REJECTED:
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-muted text-foreground';
  }
}

function getTotalHours(timesheet: Timesheet) {
  return timesheet.entries?.reduce((sum, entry) => sum + entry.hours, 0) ?? 0;
}

function getUserName(timesheets: Timesheet[]) {
  const user = timesheets.find((timesheet) => timesheet.user)?.user;

  if (!user) return 'Team Member';

  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
}

export default function TeamTimesheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [allHistoryTimesheets, setAllHistoryTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [latestWeekLabel, setLatestWeekLabel] = useState('No submitted weeks yet');
  const [employeeName, setEmployeeName] = useState('Team Member');
  const [actioningTimesheetId, setActioningTimesheetId] = useState<string | null>(null);

  const applyHistoryFilter = useCallback(async (range?: { startDate?: string; endDate?: string }) => {
    try {
      setLoading(true);
      setError('');
      const data = await operationsApi.getTimesheets({
        userId,
        startDate: range?.startDate || undefined,
        endDate: range?.endDate || undefined,
      });
      const history = data.filter((timesheet) => historyStatuses.has(timesheet.status));

      setTimesheets(history);
      setEmployeeName(getUserName(history.length > 0 ? history : data));
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to load team member timesheets'));
      setTimesheets([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await operationsApi.getTimesheets({ userId });
      const history = data.filter((timesheet) => historyStatuses.has(timesheet.status));
      const latestSubmitted = data.find((timesheet) => submittedOrApprovedStatuses.has(timesheet.status));
      const defaultEndDate = toDateInputValue(latestSubmitted?.endDate);
      const defaultHistory = defaultEndDate
        ? history.filter((timesheet) => new Date(timesheet.startDate) <= new Date(`${defaultEndDate}T23:59:59.999`))
        : history;

      setAllHistoryTimesheets(history);
      setTimesheets(defaultHistory);
      setEmployeeName(getUserName(history.length > 0 ? history : data));
      setEndDate(defaultEndDate);
      setLatestWeekLabel(
        latestSubmitted
          ? `${formatDate(latestSubmitted.startDate)} - ${formatDate(latestSubmitted.endDate)}`
          : 'No submitted weeks yet',
      );
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to load team member timesheets'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInitialData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadInitialData]);

  const handleApplyFilters = async (event: React.FormEvent) => {
    event.preventDefault();
    await applyHistoryFilter({ startDate, endDate });
  };

  const handleResetFilters = async () => {
    setStartDate('');
    const latestSubmitted = allHistoryTimesheets.find((timesheet) => submittedOrApprovedStatuses.has(timesheet.status));
    const defaultEndDate = toDateInputValue(latestSubmitted?.endDate);
    setEndDate(defaultEndDate);
    await applyHistoryFilter({ endDate: defaultEndDate });
  };

  const handleApproveTimesheet = async (timesheet: Timesheet) => {
    if (!window.confirm('Approve this timesheet?')) return;

    try {
      setActioningTimesheetId(timesheet.id);
      setError('');
      await operationsApi.approveTimesheetRA(timesheet.id);
      await loadInitialData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to approve timesheet'));
    } finally {
      setActioningTimesheetId(null);
    }
  };

  const handleRejectTimesheet = async (timesheet: Timesheet) => {
    const remarks = window.prompt('Why are you rejecting this submitted timesheet?');
    if (remarks === null) return;

    const trimmedRemarks = remarks.trim();
    if (!trimmedRemarks) {
      setError('Rejection remarks are required.');
      return;
    }

    try {
      setActioningTimesheetId(timesheet.id);
      setError('');
      await operationsApi.rejectTimesheet(timesheet.id, trimmedRemarks);
      await loadInitialData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to reject timesheet'));
    } finally {
      setActioningTimesheetId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8 animate-in">
      <button
        onClick={() => router.push('/timesheets')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Timesheets
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
            <UserRound className="text-primary" size={18} />
            {employeeName}
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1.5">
            Timesheets through latest submitted week: {latestWeekLabel}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Visible Hours</p>
          <p className="mt-1 text-2xl font-black text-primary">
            {timesheets.reduce((sum, timesheet) => sum + getTotalHours(timesheet), 0)}h
          </p>
        </div>
      </div>

      <form onSubmit={handleApplyFilters} className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">From Week</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full flex h-8 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">To Week</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full flex h-8 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <Filter size={14} />
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 rounded-lg border px-3 text-xs font-bold transition-colors hover:bg-muted"
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm font-medium">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading team member timesheets...</div>
      ) : (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-190 text-left">
              <thead className="bg-muted/50 border-b">
                <tr className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total Hours</th>
                  <th className="hidden sm:table-cell px-4 py-3">Entries</th>
                  <th className="hidden sm:table-cell px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {timesheets.map((timesheet) => (
                  <tr key={timesheet.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 font-bold">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-muted-foreground" />
                        {formatDate(timesheet.startDate)} - {formatDate(timesheet.endDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded-md text-xs font-black uppercase tracking-tighter ${getStatusColor(timesheet.status)}`}>
                        {timesheet.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold">{getTotalHours(timesheet)}h</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground font-medium">{timesheet.entries?.length ?? 0}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground font-medium">{formatDate(timesheet.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/timesheets/${timesheet.id}`)}
                          className="flex items-center justify-center rounded p-1.5 text-blue-600 hover:bg-blue-50"
                          title="View Details"
                          aria-label="View details"
                        >
                          <Eye size={16} />
                        </button>
                        {timesheet.status === TimesheetStatus.SUBMITTED && (
                          <>
                            <button
                              onClick={() => handleApproveTimesheet(timesheet)}
                              disabled={actioningTimesheetId === timesheet.id}
                              className="flex items-center justify-center rounded p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
                              title="Approve Timesheet"
                              aria-label="Approve timesheet"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => handleRejectTimesheet(timesheet)}
                              disabled={actioningTimesheetId === timesheet.id}
                              className="flex items-center justify-center rounded p-1.5 text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                              title="Reject Timesheet"
                              aria-label="Reject timesheet"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {timesheets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Clock size={42} className="mb-4 opacity-20" />
                        <p>No submitted timesheets found for this range.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
