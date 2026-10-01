'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Loader2, X, Check, Search, Store, Calendar, AlertTriangle, Trash2, UserPlus, Mail, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils';
import { format, isBefore, addDays } from 'date-fns';
import DocumentPanel from '@/components/documents/DocumentPanel';

interface RateCard {
  role: string;
  level: string;
  rate: number;
  currency: string;
}

interface VendorContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary: boolean;
}

interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  category: 'STAFFING' | 'CONSULTING' | 'TECHNOLOGY' | 'INFRASTRUCTURE' | 'OTHER';
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
  gstin?: string;
  pan?: string;
  address?: string;
  agreementStart?: string;
  agreementEnd?: string;
  rateCards?: RateCard[];
  contacts?: VendorContact[];
  isActive: boolean;
  _count?: { freelancers: number };
}

interface VendorForm {
  vendorName: string;
  category: string;
  status: string;
  gstin: string;
  pan: string;
  address: string;
  agreementStart: string;
  agreementEnd: string;
  rateCards: RateCard[];
  isActive: boolean;
}

const defaultForm: VendorForm = {
  vendorName: '', category: 'CONSULTING', status: 'ACTIVE',
  gstin: '', pan: '', address: '', agreementStart: '', agreementEnd: '',
  rateCards: [], isActive: true,
};

function VendorModal({ initial, onSave, onClose }: {
  initial?: Vendor;
  onSave: (form: VendorForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<VendorForm>(
    initial ? {
      vendorName: initial.vendorName, category: initial.category, status: initial.status,
      gstin: initial.gstin ?? '', pan: initial.pan ?? '', address: initial.address ?? '',
      agreementStart: initial.agreementStart ? format(new Date(initial.agreementStart), 'yyyy-MM-dd') : '',
      agreementEnd: initial.agreementEnd ? format(new Date(initial.agreementEnd), 'yyyy-MM-dd') : '',
      rateCards: initial.rateCards ?? [], isActive: initial.isActive,
    } : defaultForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!form.vendorName.trim()) { setError('Vendor name is required.'); return; }
    setSaving(true); setError('');
    try { await onSave(form); } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save vendor.');
    } finally { setSaving(false); }
  }

  function set<K extends keyof VendorForm>(key: K, val: VendorForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addRateCard() {
    set('rateCards', [...form.rateCards, { role: '', level: '', rate: 0, currency: 'INR' }]);
  }

  function removeRateCard(index: number) {
    const next = [...form.rateCards]; next.splice(index, 1); set('rateCards', next);
  }

  function updateRateCard(index: number, field: keyof RateCard, val: any) {
    const next = [...form.rateCards];
    next[index] = { ...next[index], [field]: val };
    set('rateCards', next);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm overflow-y-auto py-6" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-3xl shadow-lg my-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">{initial ? `Edit Vendor: ${initial.vendorCode}` : 'New Vendor'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        {error && <p className="mb-3 text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">{error}</p>}

        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto px-0.5">
          <div className="col-span-2">
            <label className="form-label">Vendor Name *</label>
            <input className="field-input" value={form.vendorName} onChange={(e) => set('vendorName', e.target.value)} placeholder="e.g. Talent Solutions Inc." />
          </div>
          <div>
            <label className="form-label">Category</label>
            <select className="field-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="STAFFING">Staffing</option>
              <option value="CONSULTING">Consulting</option>
              <option value="TECHNOLOGY">Technology</option>
              <option value="INFRASTRUCTURE">Infrastructure</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="field-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLACKLISTED">Blacklisted</option>
            </select>
          </div>
          <div>
            <label className="form-label">Agreement Start</label>
            <input type="date" className="field-input" value={form.agreementStart} onChange={(e) => set('agreementStart', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Agreement End</label>
            <input type="date" className="field-input" value={form.agreementEnd} onChange={(e) => set('agreementEnd', e.target.value)} />
          </div>
          <div>
            <label className="form-label">GSTIN</label>
            <input className="field-input" value={form.gstin} onChange={(e) => set('gstin', e.target.value)} />
          </div>
          <div>
            <label className="form-label">PAN</label>
            <input className="field-input" value={form.pan} onChange={(e) => set('pan', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="form-label">Address</label>
            <textarea className="field-textarea" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>

          <div className="col-span-2">
            <div className="flex justify-between items-center mb-2">
              <label className="form-label mb-0">Rate Cards</label>
              <button type="button" onClick={addRateCard} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus size={11} /> Add Row
              </button>
            </div>
            <div className="space-y-1.5">
              {form.rateCards.map((rc, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end bg-muted/20 p-2 rounded border border-dashed">
                  <div className="col-span-2">
                    <label className="form-label">Role</label>
                    <input className="field-input" value={rc.role} onChange={(e) => updateRateCard(i, 'role', e.target.value)} placeholder="Role" />
                  </div>
                  <div>
                    <label className="form-label">Level</label>
                    <input className="field-input" value={rc.level} onChange={(e) => updateRateCard(i, 'level', e.target.value)} placeholder="L1/Senior" />
                  </div>
                  <div>
                    <label className="form-label">Rate</label>
                    <input type="number" className="field-input" value={rc.rate} onChange={(e) => updateRateCard(i, 'rate', Number(e.target.value))} />
                  </div>
                  <div className="flex gap-1 items-center">
                    <input className="field-input" value={rc.currency} onChange={(e) => updateRateCard(i, 'currency', e.target.value)} placeholder="INR" />
                    <button onClick={() => removeRateCard(i)} className="text-destructive p-1 hover:bg-destructive/10 rounded">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {form.rateCards.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-2">No rate cards added</p>
              )}
            </div>
          </div>

          {initial && (
            <div className="col-span-2 pt-3 border-t">
              <label className="form-label">Documents</label>
              <DocumentPanel entityType="VENDOR" entityId={initial.id} />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t">
          <div>
            {initial && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="rounded border-muted" />
                <label htmlFor="isActive" className="text-xs font-medium">Active</label>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {initial ? 'Update Vendor' : 'Create Vendor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactsModal({ vendor, onClose, onRefresh }: {
  vendor: Vendor;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', designation: '', isPrimary: false });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      await api.post(`/vendors/${vendor.id}/contacts`, form);
      setForm({ name: '', email: '', phone: '', designation: '', isPrimary: false });
      setAdding(false);
      onRefresh();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function handleDelete(contactId: string) {
    if (!confirm('Delete this contact?')) return;
    try { await api.delete(`/vendors/${vendor.id}/contacts/${contactId}`); onRefresh(); }
    catch (e) { console.error(e); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-2xl shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-sm font-semibold">Contacts</h2>
            <p className="text-xs text-muted-foreground">{vendor.vendorName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        <div className="space-y-3">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Email</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Phone</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vendor.contacts?.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium flex items-center gap-1">
                        {c.name}
                        {c.isPrimary && <span className="bg-primary/10 text-primary text-xs px-1 rounded">Primary</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.designation ?? 'No designation'}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => handleDelete(c.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {(!vendor.contacts || vendor.contacts.length === 0) && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground italic">No contacts found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {adding ? (
            <div className="p-3 bg-muted/20 border rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="form-label">Full Name</label>
                  <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Designation</label>
                  <input className="field-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPrimary" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
                <label htmlFor="isPrimary" className="text-xs font-medium">Mark as Primary Contact</label>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAdding(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleAdd} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add Contact
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full py-2 border border-dashed rounded-lg text-primary text-xs hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus size={12} /> Add New Contact
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [showExpiring, setShowExpiring] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; item?: Vendor }>({ open: false });
  const [contactModal, setContactModal] = useState<{ open: boolean; vendor?: Vendor }>({ open: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/vendors';
      const params = new URLSearchParams();
      if (showExpiring) {
        url = '/vendors/expiring';
      } else {
        if (filterStatus !== 'ALL') params.append('status', filterStatus);
        if (filterCategory !== 'ALL') params.append('category', filterCategory);
      }
      const { data } = await api.get<Vendor[]>(url + (params.toString() ? `?${params.toString()}` : ''));
      setVendors(data);
    } finally { setLoading(false); }
  }, [filterStatus, filterCategory, showExpiring]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: VendorForm) {
    const payload = {
      ...form,
      agreementStart: form.agreementStart ? new Date(form.agreementStart).toISOString() : undefined,
      agreementEnd: form.agreementEnd ? new Date(form.agreementEnd).toISOString() : undefined,
      rateCards: form.rateCards.length > 0 ? form.rateCards : undefined,
    };
    if (modal.item) { await api.patch(`/vendors/${modal.item.id}`, payload); }
    else { await api.post('/vendors', payload); }
    setModal({ open: false });
    await load();
  }

  async function handleDeleteVendor(id: string) {
    if (!confirm('Soft-delete this vendor?')) return;
    await api.delete(`/vendors/${id}`);
    await load();
  }

  const filtered = vendors.filter(
    (v) => v.vendorName.toLowerCase().includes(search.toLowerCase()) || v.vendorCode.toLowerCase().includes(search.toLowerCase()),
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'INACTIVE': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'BLACKLISTED': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const isExpiringSoon = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    return isBefore(date, addDays(today, 30)) && !isBefore(date, today);
  };

  if (loading && vendors.length === 0) {
    return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Store size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Vendor Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{vendors.length} partners onboarded.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowExpiring(!showExpiring); setFilterStatus('ALL'); setFilterCategory('ALL'); }}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors', showExpiring ? 'bg-red-500 text-white border-red-600' : 'bg-background hover:bg-muted')}
          >
            <Calendar size={12} /> {showExpiring ? 'Viewing Expiring' : 'Expiring Soon'}
          </button>
          {user?.role === 'ADMIN' && (
            <button onClick={() => setModal({ open: true })} className="btn-primary">
              <Plus size={13} /> Add Vendor
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="field-input pl-8" placeholder="Search by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="field-select w-auto" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} disabled={showExpiring}>
          <option value="ALL">All Categories</option>
          <option value="STAFFING">Staffing</option>
          <option value="CONSULTING">Consulting</option>
          <option value="TECHNOLOGY">Technology</option>
          <option value="INFRASTRUCTURE">Infrastructure</option>
          <option value="OTHER">Other</option>
        </select>
        <select className="field-select w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} disabled={showExpiring}>
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
          <Building2 size={24} className="mx-auto mb-2 text-muted-foreground/30" />
          No vendors matched your filters.
          <button onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterCategory('ALL'); setShowExpiring(false); }} className="mt-2 block mx-auto text-xs text-primary hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Vendor</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Category</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Agreement End</th>
                  <th className="text-center px-3 py-2 text-xs text-muted-foreground">Freelancers</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Status</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((v) => {
                  const expiring = isExpiringSoon(v.agreementEnd);
                  return (
                    <tr key={v.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{v.vendorName}</div>
                        <div className="text-xs font-mono text-muted-foreground">{v.vendorCode}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-medium border">{v.category}</span>
                      </td>
                      <td className="px-3 py-2">
                        {v.agreementEnd ? (
                          <div className={cn('flex items-center gap-1 font-medium', expiring ? 'text-red-500' : 'text-muted-foreground')}>
                            {expiring && <AlertTriangle size={11} className="animate-pulse" />}
                            {format(new Date(v.agreementEnd), 'dd MMM yyyy')}
                          </div>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary/5 text-primary font-medium border border-primary/20 text-xs px-1">
                          {v._count?.freelancers ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', getStatusColor(v.status))}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button title="Manage Contacts" onClick={() => setContactModal({ open: true, vendor: v })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Mail size={12} />
                          </button>
                          {user?.role === 'ADMIN' && (
                            <>
                              <button onClick={() => setModal({ open: true, item: v })} className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => handleDeleteVendor(v.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal.open && (
        <VendorModal initial={modal.item} onSave={handleSave} onClose={() => setModal({ open: false })} />
      )}

      {contactModal.open && contactModal.vendor && (
        <ContactsModal
          vendor={contactModal.vendor}
          onClose={() => setContactModal({ open: false })}
          onRefresh={async () => {
            const { data } = await api.get<Vendor>(`/vendors/${contactModal.vendor?.id}`);
            setContactModal({ ...contactModal, vendor: data });
            load();
          }}
        />
      )}
    </div>
  );
}
