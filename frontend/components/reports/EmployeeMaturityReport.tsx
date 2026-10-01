'use client';

import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, ShieldCheck, Users, Filter, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { usersApi, type User } from '@/lib/users-api';
import { adminApi, type Role } from '@/lib/admin-api';
import { maturityApi, type MaturityReportResponse } from '@/lib/maturity-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/kibo-ui/combobox';

interface Department {
  id: string;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

function formatMonthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short' });
}

const DEFAULT_FILTERS = {
  year: String(CURRENT_YEAR),
  departmentId: '',
  roleId: '',
  userId: '',
  isActive: 'all' as 'all' | 'true' | 'false',
};

export default function EmployeeMaturityReport() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MaturityReportResponse | null>(null);

  useEffect(() => {
    api.get<Department[]>('/reports/meta/departments').then((res) => setDepartments(res.data)).catch(() => {});
    adminApi.getRoles().then(setRoles).catch(() => {});
    usersApi.getUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    maturityApi
      .getReport({
        year: Number(filters.year),
        departmentId: filters.departmentId || undefined,
        roleId: filters.roleId || undefined,
        userId: filters.userId || undefined,
        isActive: filters.isActive === 'all' ? undefined : filters.isActive,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [filters]);

  const userOptions = useMemo(
    () => users.map((u) => ({ value: u.id, label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email })),
    [users],
  );

  const selectedEmployeeGroup = useMemo(
    () => (filters.userId ? data?.grouped.find((g) => g.userId === filters.userId) : undefined),
    [data, filters.userId],
  );

  const chartData = useMemo(() => {
    if (!data) return [];
    if (selectedEmployeeGroup) {
      return selectedEmployeeGroup.points.map((p) => ({
        month: formatMonthLabel(p.forTheMonth),
        value: p.maturityValue,
      }));
    }
    const byMonth = new Map<string, { total: number; count: number }>();
    for (const group of data.grouped) {
      for (const point of group.points) {
        const key = formatMonthLabel(point.forTheMonth);
        const entry = byMonth.get(key) ?? { total: 0, count: 0 };
        entry.total += point.maturityValue;
        entry.count += 1;
        byMonth.set(key, entry);
      }
    }
    return Array.from(byMonth.entries()).map(([month, { total, count }]) => ({
      month,
      value: Number((total / count).toFixed(2)),
    }));
  }, [data, selectedEmployeeGroup]);

  const summary = useMemo(() => {
    const values = data?.rows.map((r) => r.maturityValue) ?? [];
    if (!values.length) return { avg: 0, highest: 0, lowest: 0, count: 0 };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      avg: Number(avg.toFixed(2)),
      highest: Math.max(...values),
      lowest: Math.min(...values),
      count: data?.grouped.length ?? 0,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Maturity Trends</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Month-wise maturity across the year
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            <RotateCcw size={13} /> Clear Filters
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Year</label>
            <Select value={filters.year} onValueChange={(v) => setFilters((f) => ({ ...f, year: v }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Department</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
              <Select value={filters.departmentId} onValueChange={(v) => setFilters((f) => ({ ...f, departmentId: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-full pl-8">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Role</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
              <Select value={filters.roleId} onValueChange={(v) => setFilters((f) => ({ ...f, roleId: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-full pl-8">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Status</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
              <Select value={filters.isActive} onValueChange={(v) => setFilters((f) => ({ ...f, isActive: v as typeof f.isActive }))}>
                <SelectTrigger className="w-full pl-8">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Employee</label>
            <Combobox
              data={userOptions}
              type="employee"
              value={filters.userId}
              onValueChange={(v) => setFilters((f) => ({ ...f, userId: v }))}
            >
              <ComboboxTrigger className="w-full justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  {filters.userId ? userOptions.find((o) => o.value === filters.userId)?.label : 'All Employees'}
                </span>
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput />
                <ComboboxEmpty />
                <ComboboxList>
                  <ComboboxGroup>
                    {userOptions.map((o) => (
                      <ComboboxItem key={o.value} value={o.value}>
                        {o.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Average Maturity', value: summary.avg.toFixed(2) },
          { label: 'Highest Score', value: summary.highest.toFixed(2) },
          { label: 'Lowest Score', value: summary.lowest.toFixed(2) },
          { label: 'Employees Tracked', value: summary.count },
        ].map((card) => (
          <div key={card.label} className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{card.label}</p>
            <p className="text-2xl font-black text-foreground mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <h3 className="text-xs font-black text-foreground uppercase tracking-tight mb-6">
          {selectedEmployeeGroup ? `${selectedEmployeeGroup.userName} — Monthly Trend` : 'Average Monthly Trend'}
        </h3>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#9CA3AF' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#9CA3AF' }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" name="Maturity" stroke="#2563EB" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-16">No data for the selected filters.</p>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Detail</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data?.rows.length ? (
              data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.userName}</TableCell>
                  <TableCell>{formatMonthLabel(row.forTheMonth)} {new Date(row.forTheMonth).getFullYear()}</TableCell>
                  <TableCell className="font-semibold">{row.maturityValue.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{row.remarks || '—'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  No records found for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
