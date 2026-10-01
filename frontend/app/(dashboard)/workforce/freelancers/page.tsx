'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  Ban,
  ChevronDown,
  Upload,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import DocumentPanel from '@/components/documents/DocumentPanel';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Skill {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
  code: string;
}

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

interface FreelancerSkill {
  skillId: string;
  level: number;
  skill: Skill;
}

interface Freelancer {
  id: string;
  freelancerCode: string;
  fullName: string;
  email: string;
  mobile?: string;
  vendorId?: string;
  vendor?: Vendor;
  experience?: number;
  country?: string;
  location?: string;
  contractStart: string;
  contractEnd: string;
  rateType: 'HOURLY' | 'DAILY' | 'FIXED';
  costPerHour: number;
  billingRate: number;
  currencyId?: string;
  currency?: Currency;
  ndaStatus: 'PENDING' | 'SIGNED' | 'EXPIRED';
  agreementUrl?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'CONTRACT_EXPIRED' | 'BLACKLISTED';
  isActive: boolean;
  skills: FreelancerSkill[];
}

type DrawerMode = 'add' | 'edit';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  mobile: '',
  vendorId: '',
  experience: '',
  country: '',
  location: '',
  contractStart: '',
  contractEnd: '',
  rateType: 'HOURLY' as const,
  costPerHour: '',
  billingRate: '',
  currencyId: '',
  ndaStatus: 'PENDING' as const,
  agreementUrl: '',
  status: 'ACTIVE' as const,
};

// ── Status helpers ─────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  INACTIVE: { label: 'Inactive', className: 'bg-muted text-foreground', icon: Clock },
  CONTRACT_EXPIRED: { label: 'Expired', className: 'bg-red-100 text-red-800', icon: AlertCircle },
  BLACKLISTED: { label: 'Blacklisted', className: 'bg-orange-100 text-orange-800', icon: Ban },
};

const ndaConfig: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  SIGNED: { label: 'Signed', className: 'bg-green-100 text-green-700' },
  EXPIRED: { label: 'Expired', className: 'bg-red-100 text-red-700' },
};

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FreelancersPage() {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'expiring'>('all');

  // Filters
  const [search, setSearch] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSkill, setFilterSkill] = useState('');

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('add');
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedSkills, setSelectedSkills] = useState<{ skillId: string; level: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Expiring list
  const [expiring, setExpiring] = useState<Freelancer[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string> = {};
      if (filterVendor) params.vendorId = filterVendor;
      if (filterStatus) params.status = filterStatus;
      if (filterSkill) params.skillId = filterSkill;

      const [freelancersRes, skillsRes, currenciesRes] = await Promise.all([
        api.get<Freelancer[]>('/freelancers', { params }),
        api.get<Skill[]>('/skills'),
        api.get<Currency[]>('/currency'),
      ]);
      setFreelancers(freelancersRes.data);
      setSkills(skillsRes.data);
      setCurrencies(currenciesRes.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filterVendor, filterStatus, filterSkill]);

  const fetchExpiring = useCallback(async () => {
    try {
      const { data } = await api.get<Freelancer[]>('/freelancers/expiring');
      setExpiring(data);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchVendors = useCallback(async () => {
    try {
      const { data } = await api.get<Vendor[]>('/vendors');
      setVendors(data);
    } catch {
      // vendors optional
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchExpiring();
    fetchVendors();
  }, [fetchData, fetchExpiring, fetchVendors]);

  // ── Drawer helpers ────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setSelectedSkills([]);
    setFormError('');
    setDrawerMode('add');
    setEditId('');
    setDrawerOpen(true);
  }

  function openEdit(f: Freelancer) {
    setForm({
      fullName: f.fullName,
      email: f.email,
      mobile: f.mobile ?? '',
      vendorId: f.vendorId ?? '',
      experience: f.experience != null ? String(f.experience) : '',
      country: f.country ?? '',
      location: f.location ?? '',
      contractStart: f.contractStart.split('T')[0],
      contractEnd: f.contractEnd.split('T')[0],
      rateType: f.rateType as typeof EMPTY_FORM.rateType,
      costPerHour: String(f.costPerHour),
      billingRate: String(f.billingRate),
      currencyId: f.currencyId ?? '',
      ndaStatus: f.ndaStatus as typeof EMPTY_FORM.ndaStatus,
      agreementUrl: f.agreementUrl ?? '',
      status: f.status as typeof EMPTY_FORM.status,
    });
    setSelectedSkills(f.skills.map(s => ({ skillId: s.skillId, level: s.level })));
    setFormError('');
    setDrawerMode('edit');
    setEditId(f.id);
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        experience: form.experience ? Number(form.experience) : undefined,
        costPerHour: Number(form.costPerHour),
        billingRate: Number(form.billingRate),
        vendorId: form.vendorId || undefined,
        currencyId: form.currencyId || undefined,
        mobile: form.mobile || undefined,
        country: form.country || undefined,
        location: form.location || undefined,
        agreementUrl: form.agreementUrl || undefined,
      };

      if (drawerMode === 'add') {
        const { data } = await api.post<Freelancer>('/freelancers', payload);
        if (selectedSkills.length > 0) {
          await api.post(`/freelancers/${data.id}/skills`, { skills: selectedSkills });
        }
      } else {
        await api.patch(`/freelancers/${editId}`, payload);
        await api.post(`/freelancers/${editId}/skills`, { skills: selectedSkills });
      }

      setDrawerOpen(false);
      fetchData();
      fetchExpiring();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setFormError(e?.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deactivate "${name}"?`)) return;
    try {
      await api.delete(`/freelancers/${id}`);
      fetchData();
      fetchExpiring();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Delete failed');
    }
  }

  function toggleSkill(skillId: string) {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skillId === skillId);
      return exists ? prev.filter(s => s.skillId !== skillId) : [...prev, { skillId, level: 1 }];
    });
  }

  function setSkillLevel(skillId: string, level: number) {
    setSelectedSkills(prev => prev.map(s => (s.skillId === skillId ? { ...s, level } : s)));
  }

  // ── Filtered list ─────────────────────────────────────────────────────────────

  const displayed = freelancers.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.fullName.toLowerCase().includes(q) ||
      f.freelancerCode.toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q)
    );
  });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Freelancers / Contractors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage contract workforce</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" />
          Add Freelancer
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['all', 'expiring'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'all' ? 'All Freelancers' : `Expiring Soon (${expiring.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'all' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name, code, email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Statuses</option>
                {Object.entries(statusConfig).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            {vendors.length > 0 && (
              <div className="relative">
                <select
                  value={filterVendor}
                  onChange={e => setFilterVendor(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All Vendors</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            )}

            <div className="relative">
              <select
                value={filterSkill}
                onChange={e => setFilterSkill(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Skills</option>
                {skills.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No freelancers found</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Code', 'Name', 'Vendor', 'Contract Start', 'Contract End', 'Rate / hr', 'Billing / hr', 'NDA', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayed.map(f => {
                    const days = daysUntil(f.contractEnd);
                    const isExpiring = days >= 0 && days <= 30 && f.status === 'ACTIVE';
                    const { icon: StatusIcon, className: statusCls, label: statusLabel } = statusConfig[f.status] ?? statusConfig.INACTIVE;
                    const ndaCfg = ndaConfig[f.ndaStatus] ?? ndaConfig.PENDING;
                    const sym = f.currency?.symbol ?? '₹';
                    return (
                      <tr key={f.id} className="hover:bg-muted/30 transition">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{f.freelancerCode}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{f.fullName}</div>
                          <div className="text-xs text-muted-foreground">{f.email}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{f.vendor?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(f.contractStart)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('font-medium', isExpiring ? 'text-red-600' : 'text-foreground')}>
                            {fmtDate(f.contractEnd)}
                          </span>
                          {isExpiring && (
                            <div className="text-xs text-red-500 font-medium">{days}d left</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{sym}{f.costPerHour.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{sym}{f.billingRate.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', ndaCfg.className)}>
                            {ndaCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', statusCls)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(f)} className="p-1.5 rounded hover:bg-muted transition" title="Edit">
                              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => handleDelete(f.id, f.fullName)} className="p-1.5 rounded hover:bg-destructive/10 transition" title="Deactivate">
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'expiring' && (
        <div className="space-y-3">
          {expiring.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No contracts expiring within 30 days</div>
          ) : (
            expiring.map(f => {
              const days = daysUntil(f.contractEnd);
              return (
                <div
                  key={f.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border',
                    days <= 7 ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn('p-2 rounded-full', days <= 7 ? 'bg-red-100' : 'bg-yellow-100')}>
                      <AlertCircle className={cn('w-5 h-5', days <= 7 ? 'text-red-600' : 'text-yellow-600')} />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{f.fullName}</div>
                      <div className="text-xs text-muted-foreground">{f.freelancerCode} · {f.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn('font-semibold', days <= 7 ? 'text-red-600' : 'text-yellow-700')}>
                      {days === 0 ? 'Expires today' : `${days} day${days !== 1 ? 's' : ''} left`}
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDate(f.contractEnd)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/65 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="w-[640px] bg-background border-l border-border flex flex-col shadow-2xl overflow-y-auto">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">
                {drawerMode === 'add' ? 'Add Freelancer' : 'Edit Freelancer'}
              </h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded hover:bg-muted transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Basic info */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Full Name *" className="col-span-2">
                    <input required value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Email *">
                    <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Mobile">
                    <input value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Experience (years)">
                    <input type="number" min={0} value={form.experience} onChange={e => setForm(p => ({ ...p, experience: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Country">
                    <input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Location" className="col-span-2">
                    <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className={inputCls} />
                  </Field>
                </div>
              </section>

              {/* Contract */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contract</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contract Start *">
                    <input required type="date" value={form.contractStart} onChange={e => setForm(p => ({ ...p, contractStart: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Contract End *">
                    <input required type="date" value={form.contractEnd} onChange={e => setForm(p => ({ ...p, contractEnd: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="NDA Status">
                    <select value={form.ndaStatus} onChange={e => setForm(p => ({ ...p, ndaStatus: e.target.value as typeof form.ndaStatus }))} className={inputCls}>
                      <option value="PENDING">Pending</option>
                      <option value="SIGNED">Signed</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as typeof form.status }))} className={inputCls}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="CONTRACT_EXPIRED">Contract Expired</option>
                      <option value="BLACKLISTED">Blacklisted</option>
                    </select>
                  </Field>
                  <Field label="Agreement URL" className="col-span-2">
                    <div className="flex gap-2">
                      <input value={form.agreementUrl} onChange={e => setForm(p => ({ ...p, agreementUrl: e.target.value }))} placeholder="https://…" className={cn(inputCls, 'flex-1')} />
                      <button
                        type="button"
                        className="flex items-center gap-1 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition"
                        title="Upload agreement document"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </button>
                    </div>
                  </Field>
                </div>
              </section>

              {/* Rates */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Rates</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rate Type">
                    <select value={form.rateType} onChange={e => setForm(p => ({ ...p, rateType: e.target.value as typeof form.rateType }))} className={inputCls}>
                      <option value="HOURLY">Hourly</option>
                      <option value="DAILY">Daily</option>
                      <option value="FIXED">Fixed</option>
                    </select>
                  </Field>
                  <Field label="Currency">
                    <select value={form.currencyId} onChange={e => setForm(p => ({ ...p, currencyId: e.target.value }))} className={inputCls}>
                      <option value="">Default</option>
                      {currencies.map(c => (
                        <option key={c.id} value={c.id}>{c.code} {c.symbol}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cost / hr *">
                    <input required type="number" min={0} step="0.01" value={form.costPerHour} onChange={e => setForm(p => ({ ...p, costPerHour: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Billing Rate / hr *">
                    <input required type="number" min={0} step="0.01" value={form.billingRate} onChange={e => setForm(p => ({ ...p, billingRate: e.target.value }))} className={inputCls} />
                  </Field>
                </div>
              </section>

              {/* Vendor */}
              {vendors.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vendor</h3>
                  <Field label="Vendor">
                    <select value={form.vendorId} onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))} className={inputCls}>
                      <option value="">None</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                      ))}
                    </select>
                  </Field>
                </section>
              )}

              {/* Skills */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {skills.map(s => {
                    const sel = selectedSkills.find(x => x.skillId === s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleSkill(s.id)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition',
                            sel
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-foreground border-border hover:border-primary/50',
                          )}
                        >
                          {s.name}
                        </button>
                        {sel && (
                          <select
                            value={sel.level}
                            onChange={e => setSkillLevel(s.id, Number(e.target.value))}
                            className="text-xs border border-border rounded px-1 py-0.5 bg-background"
                          >
                            {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>L{l}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Documents */}
              {drawerMode === 'edit' && editId && (
                <section className="space-y-3 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Documents</h3>
                  <DocumentPanel entityType="FREELANCER" entityId={editId} />
                </section>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {drawerMode === 'add' ? 'Create Freelancer' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring';

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
