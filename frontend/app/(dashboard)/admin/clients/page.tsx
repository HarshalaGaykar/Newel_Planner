'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Loader2, X, Check, Search, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils';
import DocumentPanel from '@/components/documents/DocumentPanel';

interface Client {
  id: string;
  clientCode: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  contactPerson?: string;
  currencyId?: string;
  isActive: boolean;
  currency?: { id: string; code: string; symbol: string };
}

interface ClientForm {
  name: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string;
  address: string;
  contactPerson: string;
  currencyId: string;
  isActive: boolean;
}

const defaultForm: ClientForm = {
  name: '',
  email: '',
  phone: '',
  gstin: '',
  pan: '',
  address: '',
  contactPerson: '',
  currencyId: '',
  isActive: true,
};

function ClientModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Client;
  onSave: (form: ClientForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ClientForm>(
    initial
      ? {
          name: initial.name,
          email: initial.email ?? '',
          phone: initial.phone ?? '',
          gstin: initial.gstin ?? '',
          pan: initial.pan ?? '',
          address: initial.address ?? '',
          contactPerson: initial.contactPerson ?? '',
          currencyId: initial.currencyId ?? '',
          isActive: initial.isActive,
        }
      : defaultForm,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currencies, setCurrencies] = useState<{ id: string; code: string; symbol: string }[]>([]);

  useEffect(() => {
    api.get('/currencies').then(({ data }) => setCurrencies(data)).catch(() => {});
  }, []);

  async function handleSave() {
    if (!form.name.trim()) { setError('Client name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save client.');
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof ClientForm>(key: K, val: ClientForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-2xl shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">{initial ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors"><X size={14} /></button>
        </div>

        {error && <p className="mb-3 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="form-label">Client Name *</label>
              <input className="field-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Acme Corporation" />
            </div>
            <div>
              <label className="form-label">Contact Person</label>
              <input className="field-input" value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" className="field-input" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input className="field-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select className="field-select" value={form.currencyId} onChange={(e) => set('currencyId', e.target.value)}>
                <option value="">-- Select Currency --</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>
                ))}
              </select>
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
            {initial && (
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="rounded" />
                <label htmlFor="isActive" className="text-xs font-medium">Active</label>
              </div>
            )}
          </div>

          {initial && (
            <div className="mt-3 pt-3 border-t">
              <label className="form-label">Documents</label>
              <DocumentPanel entityType="CLIENT" entityId={initial.id} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {initial ? 'Update' : 'Create'} Client
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; item?: Client }>({ open: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Client[]>('/clients');
      setClients(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: ClientForm) {
    const payload = {
      ...form,
      email: form.email || undefined,
      phone: form.phone || undefined,
      gstin: form.gstin || undefined,
      pan: form.pan || undefined,
      address: form.address || undefined,
      contactPerson: form.contactPerson || undefined,
      currencyId: form.currencyId || undefined,
    };
    if (modal.item) {
      await api.patch(`/clients/${modal.item.id}`, payload);
    } else {
      await api.post('/clients', payload);
    }
    setModal({ open: false });
    await load();
  }

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.clientCode.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Clients</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''} total</p>
          </div>
        </div>
        {user?.role === 'ADMIN' && (
          <button onClick={() => setModal({ open: true })} className="btn-primary">
            <Plus size={13} /> New Client
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className="field-input pl-8"
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg text-center">
          <Building2 size={28} className="text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">No clients found</p>
          {user?.role === 'ADMIN' && (
            <button onClick={() => setModal({ open: true })} className="mt-2 text-xs text-primary hover:underline">
              Add your first client
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Contact</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  {user?.role === 'ADMIN' && (
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className={cn('border-b last:border-0 hover:bg-muted/20 transition-colors', i % 2 === 0 ? '' : 'bg-muted/5')}>
                    <td className="px-3 py-2 font-mono font-medium text-primary">{c.clientCode}</td>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.contactPerson ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.email ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.phone ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-xs font-medium',
                        c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
                      )}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setModal({ open: true, item: c })}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal.open && (
        <ClientModal initial={modal.item} onSave={handleSave} onClose={() => setModal({ open: false })} />
      )}
    </div>
  );
}
