'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, FileSpreadsheet, Calendar, Download, Loader2,
  TrendingUp, Target, Users, Briefcase, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import OperationalReports from '@/components/reports/OperationalReports';

interface ReportData {
  summary: any[];
  utilization?: any[];
  timesheets?: any[];
}

type TabId = 'overview' | 'utilization' | 'timesheets' | 'operational';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, utilRes, timesheetRes] = await Promise.all([
        api.get('/reports/project-summary'),
        api.get('/reports/utilization'),
        api.get('/reports/timesheets'),
      ]);
      setData({ summary: summaryRes.data, utilization: utilRes.data, timesheets: timesheetRes.data });
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/reports/export/project-summary', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'project-summary.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading && activeTab !== 'operational') {
    return (
      <div className="py-16 text-center flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Generating reports...</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Project Summary', icon: <Briefcase size={13} /> },
    { id: 'utilization', label: 'Utilization', icon: <Users size={13} /> },
    { id: 'timesheets', label: 'Timesheet Audit', icon: <FileSpreadsheet size={13} /> },
    { id: 'operational', label: 'Operational', icon: <Activity size={13} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Reporting Hub</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Data-driven insights and cross-module performance audits.</p>
          </div>
        </div>
        {activeTab !== 'operational' && (
          <button onClick={handleExport} disabled={exporting} className="btn-primary">
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Export CSV
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
              activeTab === tab.id ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:bg-card/50'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { title: 'Total Revenue', value: '₹2.2M', icon: <TrendingUp size={14} />, subtitle: '+12% from target', bg: 'bg-emerald-50 text-emerald-600' },
                { title: 'Avg Margin', value: '28%', icon: <Target size={14} />, subtitle: 'Consistent with Q1', bg: 'bg-blue-50 text-blue-600' },
                { title: 'SLA Breach', value: '4.2%', icon: <Calendar size={14} />, subtitle: 'Target < 5%', bg: 'bg-amber-50 text-amber-600' },
                { title: 'Active Projects', value: '14', icon: <Briefcase size={14} />, subtitle: '2 pending closure', bg: 'bg-purple-50 text-purple-600' },
              ].map((s, i) => (
                <div key={i} className="bg-card border rounded-lg p-3 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.title}</p>
                    <p className="text-lg font-semibold text-foreground mt-0.5">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.subtitle}</p>
                  </div>
                  <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0', s.bg)}>
                    {s.icon}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-foreground mb-3">Revenue by Project</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.summary}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <Tooltip cursor={{ fill: '#F9FAFB' }} />
                    <Bar dataKey="totalRevenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {activeTab === 'utilization' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-foreground mb-3">Resource Allocation</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.utilization}
                      dataKey="utilization"
                      nameKey="userName"
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={5}
                      label={({ value }) => `${value.toFixed(1)}%`}
                    >
                      {data?.utilization?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#2563EB', '#10B981', '#F59E0B', '#EF4444'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-foreground mb-3">Utilization Details</h3>
              <div className="space-y-2">
                {data?.utilization?.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div>
                      <p className="text-xs font-medium text-foreground">{u.userName}</p>
                      <p className="text-xs text-muted-foreground">Allocation score</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">{u.utilization.toFixed(1)}%</p>
                      <div className="w-20 h-1 bg-muted rounded-full mt-1">
                        <div
                          className={cn('h-full rounded-full', u.utilization > 100 ? 'bg-red-500' : 'bg-primary')}
                          style={{ width: `${Math.min(u.utilization, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timesheets' && (
          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            <div className="p-3 border-b">
              <h3 className="text-xs font-semibold text-foreground">Weekly Timesheet Audit</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Resource time logging compliance and efficiency.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-muted-foreground">Resource</th>
                    <th className="px-3 py-2 text-left text-xs text-muted-foreground">Logged Hours</th>
                    <th className="px-3 py-2 text-left text-xs text-muted-foreground">Compliance</th>
                    <th className="px-3 py-2 text-right text-xs text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.timesheets?.map((t) => (
                    <tr key={t.userId} className="hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2 font-medium">{t.userName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t.totalHours} hrs</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 w-20 h-1 bg-muted rounded-full">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }} />
                          </div>
                          <span className="text-xs">92%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">COMPLIANT</span>
                      </td>
                    </tr>
                  ))}
                  {data?.timesheets?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-12 text-center text-muted-foreground">No timesheet records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'operational' && <OperationalReports />}
      </div>
    </div>
  );
}
