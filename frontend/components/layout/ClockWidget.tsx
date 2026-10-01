'use client';

import { useEffect, useState, useCallback } from 'react';
import { LogIn, LogOut, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { operationsApi, Attendance } from '@/lib/operations-api';

function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function ClockWidget() {
  // undefined = initial fetch in-flight, null = no record today
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null | undefined>(undefined);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTime, setConfirmTime] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const data = await operationsApi.getTodayAttendance(getBrowserTimeZone());
      setTodayAttendance(data);
    } catch {
      setTodayAttendance(null);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Sync when the Attendance page (or any other surface) updates attendance
    const handler = () => { void fetchStatus(); };
    window.addEventListener('attendance-updated', handler);
    return () => window.removeEventListener('attendance-updated', handler);
  }, [fetchStatus]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await operationsApi.checkIn({ timeZone: getBrowserTimeZone() });
      await fetchStatus();
      window.dispatchEvent(new CustomEvent('attendance-updated'));
    } catch {
      // attendance page is the canonical error surface
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirm = () => {
    setConfirmTime(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    setConfirmOpen(true);
  };

  const handleCheckOut = async () => {
    setConfirmOpen(false);
    setActionLoading(true);
    try {
      await operationsApi.checkOut({ timeZone: getBrowserTimeZone() });
      await fetchStatus();
      window.dispatchEvent(new CustomEvent('attendance-updated'));
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (todayAttendance === undefined) {
    return <Loader2 size={13} className="animate-spin text-muted-foreground" />;
  }

  // Fully checked out — show check-out time
  if (todayAttendance?.checkOut) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
        <CheckCircle2 size={12} />
        <span>Out {formatTime(todayAttendance.checkOut)}</span>
      </div>
    );
  }

  // Not yet checked in
  if (!todayAttendance) {
    return (
      <button
        onClick={handleCheckIn}
        disabled={actionLoading}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
        Check In
      </button>
    );
  }

  // Checked in — show check-in time + clock-out button
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
          <Clock size={11} />
          <span>In {formatTime(todayAttendance.checkIn)}</span>
        </div>

        <button
          onClick={openConfirm}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
          Check Out
        </button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <LogOut size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Clock Out?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This will record your check-out for today.</p>
              </div>
            </div>

            <div className="bg-muted rounded-lg px-4 py-3 mb-5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Clock out time</p>
              <p className="text-2xl font-black text-foreground tracking-tight">{confirmTime}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors"
              >
                No, Cancel
              </button>
              <button
                onClick={handleCheckOut}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
              >
                Yes, Check Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
