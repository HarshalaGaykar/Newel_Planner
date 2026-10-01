'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Users, Clock, CalendarOff, UserPlus, AlertTriangle, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function HRDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard/hr')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Loading HR Data...</p>
        </div>
      </div>
    );

  if (!data) return null;

  const att = data.attendanceThisWeek ?? {};
  const presentPct = att.totalWorkingDays
    ? Math.round(((att.present ?? 0) / ((data.headcount || 1) * att.totalWorkingDays)) * 100)
    : 0;

  const leaveTrendChartData = (data.leaveTrend ?? []).map((r: any) => ({
    week: new Date(r.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    leaves: r.leaveCount,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-black text-foreground tracking-tight uppercase">HR Overview</h1>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Headcount</p>
          </div>
          <p className="text-2xl font-black text-foreground">{data.headcount ?? 0}</p>
          <p className="text-xs font-bold text-muted-foreground">Active employees</p>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-sm border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-2 mb-2">
            <CalendarOff className="w-4 h-4 text-yellow-500" />
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Pending Leaves</p>
          </div>
          <p className="text-2xl font-black text-foreground">{data.pendingLeaves ?? 0}</p>
          <p className="text-xs font-bold text-muted-foreground">Awaiting approval</p>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-sm border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-4 h-4 text-green-500" />
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">New Joiners</p>
          </div>
          <p className="text-2xl font-black text-foreground">{data.newJoinees?.length ?? 0}</p>
          <p className="text-xs font-bold text-muted-foreground">Last 30 days</p>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-sm border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Expiring Contracts</p>
          </div>
          <p className="text-2xl font-black text-foreground">{data.expiringContracts?.length ?? 0}</p>
          <p className="text-xs font-bold text-muted-foreground">Next 30 days</p>
        </div>
      </div>

      {/* Attendance this week */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Attendance This Week</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Present', value: att.present ?? 0, color: 'text-green-600' },
            { label: 'Check-in Missing', value: att.absent ?? 0, color: 'text-red-600' },
            { label: 'Late', value: att.late ?? 0, color: 'text-yellow-600' },
            { label: 'WFH', value: att.wfh ?? 0, color: 'text-blue-600' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-black text-muted-foreground uppercase">Attendance Rate</span>
            <span className="text-xs font-black text-green-600">{presentPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              style={{ width: `${Math.min(presentPct, 100)}%` }}
              className="h-full bg-green-500 rounded-full transition-all duration-700"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave trend chart */}
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Leave Trend — Last 8 Weeks</h3>
          </div>
          {leaveTrendChartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaveTrendChartData} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#9CA3AF' }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#9CA3AF' }} />
                  <Tooltip />
                  <Bar dataKey="leaves" name="Leaves" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest text-center py-12">No data</p>
          )}
        </div>

        {/* Top leave takers */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Top Leave Takers — This Month</h3>
          </div>
          <div className="divide-y divide-border">
            {(!data.topLeaveTakers || data.topLeaveTakers.length === 0) && (
              <p className="px-6 py-8 text-center text-xs font-black text-muted-foreground/50 uppercase tracking-widest">No data</p>
            )}
            {(data.topLeaveTakers ?? []).map((taker: any, i: number) => (
              <div key={taker.userId} className="px-6 py-3 flex items-center gap-3">
                <span className="w-5 text-xs font-black text-muted-foreground/50">#{i + 1}</span>
                <p className="flex-1 text-xs font-black text-foreground">{taker.name || 'Unknown'}</p>
                <span className="text-xs font-black text-purple-600">{taker.leaveDays}d</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New joiners */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight">New Joiners — Last 30 Days</h3>
          </div>
          <div className="divide-y divide-border">
            {(!data.newJoinees || data.newJoinees.length === 0) && (
              <p className="px-6 py-8 text-center text-xs font-black text-muted-foreground/50 uppercase tracking-widest">No new joiners</p>
            )}
            {(data.newJoinees ?? []).map((emp: any) => (
              <div key={emp.id} className="px-6 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-green-600">
                    {(emp.firstName?.[0] ?? '') + (emp.lastName?.[0] ?? '')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-foreground">
                    {`${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim()}
                  </p>
                  <p className="text-xs font-bold text-muted-foreground">{emp.designation ?? '—'}</p>
                </div>
                <span className="text-xs font-black text-muted-foreground/60 whitespace-nowrap">
                  {new Date(emp.dateOfJoining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expiring contracts */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight">Expiring Contracts — Next 30 Days</h3>
          </div>
          <div className="divide-y divide-border">
            {(!data.expiringContracts || data.expiringContracts.length === 0) && (
              <p className="px-6 py-8 text-center text-xs font-black text-muted-foreground/50 uppercase tracking-widest">No expiring contracts</p>
            )}
            {(data.expiringContracts ?? []).map((fl: any) => {
              const daysLeft = Math.ceil(
                (new Date(fl.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              return (
                <div key={fl.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-foreground">{fl.fullName}</p>
                    <p className="text-xs font-bold text-muted-foreground">{fl.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-red-600">{daysLeft}d left</p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {new Date(fl.contractEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
