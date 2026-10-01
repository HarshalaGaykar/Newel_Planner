'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { API_BASE_URL } from '@/lib/api-url';
import {
  Users, Calendar, Download, Search,
  BarChart3, UserCheck, Percent,
  TrendingUp, ListFilter, X
} from 'lucide-react';
import TimesheetReport from './TimesheetReport';

export default function UtilizationReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<any[]>([]);
  // Drill-in target for the "view timesheet for this period" modal, opened by
  // clicking a row. Holds just enough to re-seed TimesheetReport's own filters.
  const [drillIn, setDrillIn] = useState<{ userId: string; name: string } | null>(null);

  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // Start of month
    endDate: new Date().toISOString().split('T')[0],
    userId: '',
    status: ''
  });

  useEffect(() => {
    api.get('/users/team-members')
      .then(res => setResources(res.data))
      .catch(err => console.error('Error fetching resources:', err));
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
      );
      const query = new URLSearchParams(activeFilters as any).toString();
      const res = await api.get(`/reports/utilization?${query}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching utilization report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const handleExport = () => {
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = new URLSearchParams(activeFilters as any).toString();
    window.open(`${API_BASE_URL}/reports/export/utilization?${query}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Bar */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-lg shadow-sm/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">Resource Utilization Audit</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Workforce efficiency & capacity analytics</p>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition shadow-lg shadow-sm"
          >
            <Download className="w-3 h-3" />
            Export Utilization
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Start Date</label>
            <input 
              type="date" 
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-full px-3 py-1.5 text-xs font-bold bg-muted border-none rounded-lg focus:ring-1 focus:ring-ring transition"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">End Date</label>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-full px-3 py-1.5 text-xs font-bold bg-muted border-none rounded-lg focus:ring-1 focus:ring-ring transition"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Resource</label>
            <select 
              value={filters.userId}
              onChange={(e) => setFilters({...filters, userId: e.target.value})}
              className="w-full px-3 py-1.5 text-xs font-bold bg-muted border-none rounded-lg focus:ring-1 focus:ring-ring appearance-none transition"
            >
              <option value="">All active resources</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.firstName} {r.lastName}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Timesheet Status</label>
            <select 
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full px-3 py-1.5 text-xs font-bold bg-muted border-none rounded-lg focus:ring-1 focus:ring-ring appearance-none transition"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card p-4 rounded-xl border border-border shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Avg. Utilization</p>
              <h3 className="text-sm font-black text-foreground">{Math.round(data.reduce((s, i) => s + i.utilization, 0) / (data.length || 1))}%</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Active Resources</p>
              <h3 className="text-sm font-black text-foreground">{data.length}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Total M-Hours</p>
              <h3 className="text-sm font-black text-foreground">{data.reduce((s, i) => s + i.loggedHours, 0).toFixed(1)}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-muted text-foreground flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Report Table */}
      <div className="bg-card rounded-xl border border-border shadow-md/20 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Calculating Utilization...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest">Resource Identity</th>
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest">Logged Effort</th>
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest text-center">Utilization Index</th>
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                  {data.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setDrillIn({ userId: item.id, name: `${item.firstName} ${item.lastName}`.trim() })}
                    title="View timesheet for this period"
                    className="hover:bg-muted/50 transition group cursor-pointer"
                  >
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <div className="text-xs font-black text-foreground group-hover:text-blue-600 transition">
                          {item.firstName} {item.lastName}
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] ${item.type === 'FREELANCER' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {item.type}
                          </span>
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-0.5">{item.email} • {item.department}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-xs font-black text-foreground">{item.loggedHours.toFixed(1)} <span className="text-xs text-muted-foreground">/ {item.targetHours}h</span></div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs font-black text-foreground">{item.utilization.toFixed(1)}%</div>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-700 ${
                              item.utilization > 100 ? 'bg-red-500' : 
                              item.utilization > 80 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(item.utilization, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-[0.1em] ${
                        item.utilization > 100 ? 'bg-red-100 text-red-600' : 
                        item.utilization > 75 ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.utilization > 100 ? 'Over-utilized' : item.utilization > 75 ? 'Optimal' : 'Under-utilized'}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">No utilization data found for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-in: this resource's timesheet for the same period, without leaving the page */}
      {drillIn && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="bg-background border rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-sm font-black text-foreground uppercase tracking-tight">Timesheet — {drillIn.name}</h2>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  {filters.startDate} → {filters.endDate}
                </p>
              </div>
              <button
                onClick={() => setDrillIn(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <TimesheetReport
                initialFilters={{
                  userId: drillIn.userId,
                  startDate: filters.startDate,
                  endDate: filters.endDate,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
