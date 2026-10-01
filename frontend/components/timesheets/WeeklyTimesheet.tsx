'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';

interface TimesheetEntry {
  id: string;
  date: string;
  hours: number;
  activity: string;
  subActivity: string;
}

interface Timesheet {
  id: string;
  status: string;
  entries: TimesheetEntry[];
}

export default function WeeklyTimesheet() {
  const { user } = useAuthStore();
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(false);

  const weekDays = [
    { name: 'Mon', date: '2026-04-20' },
    { name: 'Tue', date: '2026-04-21' },
    { name: 'Wed', date: '2026-04-22' },
    { name: 'Thu', date: '2026-04-23' },
    { name: 'Fri', date: '2026-04-24' },
    { name: 'Sat', date: '2026-04-25' },
    { name: 'Sun', date: '2026-04-26' },
  ];

  useEffect(() => {
    if (user) {
      setLoading(true);
      api.post('/timesheets/weekly', {
        userId: user.id,
        startDate: weekDays[0].date,
        endDate: weekDays[6].date,
      }).then(res => {
        setTimesheet(res.data);
      }).finally(() => setLoading(false));
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!timesheet) return;
    try {
      await api.patch(`/timesheets/${timesheet.id}/submit`);
      setTimesheet({ ...timesheet, status: 'SUBMITTED' });
    } catch (err) {
      alert('Error submitting timesheet');
    }
  };

  if (loading) return <div className="p-8">Loading timesheet...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Weekly Timesheet</h1>
          <p className="text-muted-foreground mt-1">Week starting {weekDays[0].date}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            timesheet?.status === 'DRAFT' ? 'bg-muted text-foreground' :
            timesheet?.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {timesheet?.status || 'UNKNOWN'}
          </span>
          {timesheet?.status === 'DRAFT' && (
            <button 
              onClick={handleSubmit}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-bold"
            >
              Submit for Approval
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-x-auto">
        <div className="min-w-150">
          <div className="grid grid-cols-8 border-b border-border bg-muted">
            <div className="p-4 font-bold text-muted-foreground text-sm border-r border-border">Activity</div>
            {weekDays.map(day => (
              <div key={day.date} className="p-4 text-center">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{day.name}</div>
                <div className="text-sm font-bold mt-1">{new Date(day.date).getDate()}</div>
              </div>
            ))}
          </div>

          {/* Dummy Row for demonstration */}
          <div className="grid grid-cols-8 hover:bg-muted transition border-b border-border">
            <div className="p-4 border-r border-border">
              <div className="text-sm font-bold text-foreground">Feature Development</div>
              <div className="text-xs text-muted-foreground font-medium">Development</div>
            </div>
            {weekDays.map(day => (
              <div key={day.date} className="p-2 flex items-center justify-center">
                <input
                  type="number"
                  defaultValue={day.name === 'Sat' || day.name === 'Sun' ? 0 : 8}
                  disabled={timesheet?.status !== 'DRAFT'}
                  className="w-12 h-10 text-center text-sm font-bold bg-transparent border-2 border-transparent hover:border-border focus:border-blue-500 focus:bg-card rounded-lg outline-none transition"
                />
              </div>
            ))}
          </div>

          <div className="p-4 bg-muted flex justify-end gap-12 border-t border-border">
            <div className="text-right">
              <span className="text-xs font-bold text-muted-foreground block mb-1 uppercase tracking-wider">Weekly Total</span>
              <span className="text-xl font-black text-foreground">40.0h</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Leave Context</h4>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-sm font-medium">No leave records this week</span>
          </div>
        </div>
      </div>
    </div>
  );
}
