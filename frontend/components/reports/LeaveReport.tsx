'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { API_BASE_URL } from '@/lib/api-url';
import {
  Calendar, Building2, Download, Users, CalendarClock, AlertTriangle, User,
  FileSpreadsheet, Search, Clock, CheckCircle2, XCircle, ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type ReportTab = 'department' | 'register' | 'balances';

interface EmployeeOption {
  id: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
};

export default function LeaveReport() {
  const now = new Date();
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [deptId, setDeptId] = useState('');
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('department');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Load department options
  useEffect(() => {
    api.get('/reports/meta/departments').then(res => setDepartments(res.data)).catch(() => {});
  }, []);

  // Load employees list (filtered by department when chosen)
  useEffect(() => {
    const params = deptId ? { departmentId: deptId } : {};
    api.get('/reports/meta/employees', { params })
      .then(res => setEmployees(res.data))
      .catch(() => {});
  }, [deptId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        month,
        year,
        departmentId: deptId || undefined,
        userId: userId || undefined,
      };
      const res = await api.get('/reports/leave-report', { params });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [month, year, deptId, userId]);

  const handleExport = () => {
    const query = new URLSearchParams({
      month,
      year,
      export: 'excel',
      ...(deptId ? { departmentId: deptId } : {}),
      ...(userId ? { userId } : {}),
    }).toString();
    window.open(`${API_BASE_URL}/reports/leave-report?${query}`, '_blank');
  };

  const totalLeaveDays = data?.summary?.reduce((s: number, r: any) => s + r.totalLeaveDays, 0) ?? 0;
  const totalPending = data?.summary?.reduce((s: number, r: any) => s + r.pendingApprovals, 0) ?? 0;
  const expiringCount = data?.carryForward?.filter((r: any) => r.daysExpiringSoon > 0).length ?? 0;
  const totalRegisterCount = data?.register?.length ?? 0;

  // Filtered rows for current active tab based on in-page search
  const filteredSummary = useMemo(() => {
    if (!data?.summary) return [];
    if (!search.trim()) return data.summary;
    const q = search.toLowerCase();
    return data.summary.filter((r: any) =>
      r.department?.toLowerCase().includes(q) ||
      r.topLeaveType?.toLowerCase().includes(q)
    );
  }, [data?.summary, search]);

  const filteredRegister = useMemo(() => {
    if (!data?.register) return [];
    if (!search.trim()) return data.register;
    const q = search.toLowerCase();
    return data.register.filter((r: any) =>
      r.employeeName?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q) ||
      r.leaveType?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    );
  }, [data?.register, search]);

  const filteredCarryForward = useMemo(() => {
    if (!data?.carryForward) return [];
    if (!search.trim()) return data.carryForward;
    const q = search.toLowerCase();
    return data.carryForward.filter((r: any) =>
      r.employee?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.leaveType?.toLowerCase().includes(q)
    );
  }, [data?.carryForward, search]);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Leave Report</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Department summary · individual register · carry-forward risk
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition shadow-lg self-start md:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Month</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-muted border-none rounded-xl focus:ring-2 focus:ring-ring appearance-none transition"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-4 py-2 text-xs font-bold bg-muted border-none rounded-xl focus:ring-2 focus:ring-ring transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Department</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={deptId}
                onChange={(e) => {
                  setDeptId(e.target.value);
                  setUserId(''); // Reset employee filter on department change
                }}
                className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-muted border-none rounded-xl focus:ring-2 focus:ring-ring appearance-none transition"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Employee</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-muted border-none rounded-xl focus:ring-2 focus:ring-ring appearance-none transition"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.departmentName ? `(${emp.departmentName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-primary p-5 rounded-xl text-primary-foreground shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-primary-foreground/70 uppercase tracking-[0.2em] mb-1">Total Leave Days</p>
            <h3 className="text-2xl font-black">{totalLeaveDays}</h3>
            <p className="text-[11px] text-primary-foreground/60 mt-0.5">{totalRegisterCount} applications</p>
          </div>
          <div className="size-11 rounded-xl bg-card/10 flex items-center justify-center">
            <Users className="size-5" />
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Pending Approvals</p>
            <h3 className="text-2xl font-black text-foreground">{totalPending}</h3>
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Awaiting manager action</p>
          </div>
          <div className="size-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <CalendarClock className="size-5" />
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Balances Expiring (90d)</p>
            <h3 className="text-2xl font-black text-foreground">{expiringCount}</h3>
            <p className="text-[11px] text-red-600 font-semibold mt-0.5">Carry-forward liability</p>
          </div>
          <div className="size-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="size-5" />
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Active Filter</p>
            <h3 className="text-base font-black text-foreground truncate max-w-36">
              {userId ? (employees.find(e => e.id === userId)?.name ?? '1 Employee') : deptId ? (departments.find(d => d.id === deptId)?.name ?? '1 Dept') : 'All Staff'}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {userId ? 'Single employee view' : 'Organization view'}
            </p>
          </div>
          <div className="size-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
            <FileSpreadsheet className="size-5" />
          </div>
        </div>
      </div>

      {/* View Tabs & Content */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Navigation Tabs and Quick Search */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-1.5 p-1 rounded-lg border bg-muted/40">
            <button
              type="button"
              onClick={() => setActiveTab('department')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${
                activeTab === 'department'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Department Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${
                activeTab === 'register'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Individual Register ({data?.register?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('balances')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${
                activeTab === 'balances'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Balances & Carry Forward
            </button>
          </div>

          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search table rows..."
              className="h-8 w-full pl-8 pr-3 rounded-lg border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Tables */}
        {loading ? (
          <div className="p-20 text-center">
            <div className="size-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading leave data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* 1. Department Summary Table */}
            {activeTab === 'department' && (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    {['Department', 'Headcount', 'Leave Days', 'Paid Leave', 'Unpaid', 'Utilization %', 'Sandwich', 'Top Type', 'Pending'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-xs font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSummary.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3.5 text-xs font-black text-foreground">{r.department}</td>
                      <td className="px-5 py-3.5 text-xs">{r.headcount}</td>
                      <td className="px-5 py-3.5 text-xs font-bold">{r.totalLeaveDays}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{r.paidDays}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{r.unpaidDays}</td>
                      <td className="px-5 py-3.5 text-xs font-medium">{r.utilizationPct}%</td>
                      <td className="px-5 py-3.5 text-xs">{r.sandwichDays}</td>
                      <td className="px-5 py-3.5 text-xs font-medium">{r.topLeaveType}</td>
                      <td className="px-5 py-3.5 text-xs font-black">
                        {r.pendingApprovals > 0 ? (
                          <span className="text-amber-600 font-bold">{r.pendingApprovals}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSummary.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                        No department summary records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 2. Individual Leave Register Table */}
            {activeTab === 'register' && (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    {['Employee', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Half Day', 'Status', 'Reason', 'Applied On'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-xs font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRegister.map((lv: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3.5 text-xs">
                        <p className="font-bold text-foreground">{lv.employeeName}</p>
                        <p className="text-[11px] text-muted-foreground">{lv.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{lv.department}</td>
                      <td className="px-5 py-3.5 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                          {lv.leaveType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono">{lv.startDate}</td>
                      <td className="px-5 py-3.5 text-xs font-mono">{lv.endDate}</td>
                      <td className="px-5 py-3.5 text-xs font-black text-foreground">{lv.totalDays}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{lv.halfDay}</td>
                      <td className="px-5 py-3.5 text-xs">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_BADGE_STYLES[lv.status] ?? STATUS_BADGE_STYLES.CANCELLED}`}>
                          {lv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-foreground/80 max-w-[200px] truncate" title={lv.reason}>
                        {lv.reason || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono">{lv.applicationDate}</td>
                    </tr>
                  ))}
                  {filteredRegister.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                        No leave records found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 3. Balances & Carry Forward Table */}
            {activeTab === 'balances' && (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    {['Employee', 'Leave Type', 'Earned', 'Used', 'Available', 'Carried Over', 'Expiry Date', 'Expiring Soon (90d)'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-xs font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCarryForward.map((b: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3.5 text-xs">
                        <p className="font-bold text-foreground">{b.employee}</p>
                        <p className="text-[11px] text-muted-foreground">{b.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-foreground">{b.leaveType}</td>
                      <td className="px-5 py-3.5 text-xs">{b.earned}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{b.used}</td>
                      <td className="px-5 py-3.5 text-xs font-black text-foreground">{b.available}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{b.carriedForward}</td>
                      <td className="px-5 py-3.5 text-xs font-mono text-muted-foreground">{b.expiryDate}</td>
                      <td className="px-5 py-3.5 text-xs">
                        {b.daysExpiringSoon > 0 ? (
                          <span className="inline-flex items-center gap-1 font-black text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200">
                            <AlertTriangle size={11} /> {b.daysExpiringSoon} days
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredCarryForward.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                        No balance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
