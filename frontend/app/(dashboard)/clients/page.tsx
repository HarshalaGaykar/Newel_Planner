'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, Plus, Edit2, Trash2, AlertCircle, ArrowLeft, Building, Loader2, Users, X } from 'lucide-react';
import { clientsApi, Client, ClientContact } from '@/lib/clients-api';
import { useAuthStore } from '@/lib/store/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

function inputCls() {
  return 'w-full flex h-10 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
}

export default function ClientsPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN';

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<Client>>({});
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactError, setContactError] = useState('');
  const contactNameRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clientsApi.getClients();
      setClients(data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCurrent({ isActive: true });
    setContacts([]);
    setContactName('');
    setContactEmail('');
    setContactError('');
    setError('');
    setModal('create');
  };

  const openEdit = (client: Client) => {
    setCurrent({ ...client });
    setContacts(client.contacts ? [...client.contacts] : []);
    setContactName('');
    setContactEmail('');
    setContactError('');
    setError('');
    setModal('edit');
  };

  const addContact = () => {
    const name = contactName.trim();
    const email = contactEmail.trim();
    if (!name || !email) {
      setContactError('Name and email are required.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setContactError('Enter a valid email address.');
      return;
    }
    if (contacts.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
      setContactError('This email has already been added for this client.');
      return;
    }
    setContacts((prev) => [...prev, { name, email }]);
    setContactName('');
    setContactEmail('');
    setContactError('');
    contactNameRef.current?.focus();
  };

  const removeContact = (email: string) => {
    setContacts((prev) => prev.filter((c) => c.email.toLowerCase() !== email.toLowerCase()));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Send only what CreateClientDto accepts. `current` holds the full record
      // loaded from the API, and the backend runs ValidationPipe with
      // forbidNonWhitelisted — so spreading it would 400 on server-managed
      // fields (id, clientCode, createdAt, updatedAt, currency).
      const payload = {
        name: current.name ?? '',
        gstin: current.gstin ?? undefined,
        pan: current.pan ?? undefined,
        email: current.email ?? undefined,
        phone: current.phone ?? undefined,
        address: current.address ?? undefined,
        contactPerson: current.contactPerson ?? undefined,
        currencyId: current.currencyId ?? undefined,
        isActive: current.isActive ?? true,
        contacts: contacts.map((c) => ({ name: c.name, email: c.email })),
      };

      if (modal === 'create') {
        await clientsApi.createClient(payload);
      } else {
        await clientsApi.updateClient(current.id!, payload);
      }
      setModal(null);
      load();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    setError('');
    try {
      await clientsApi.deleteClient(id);
      load();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Failed to delete client');
    }
  };

  const query = search.trim().toLowerCase();
  const hasActiveQuery = query.length > 0 || statusFilter !== 'ALL';

  const filteredClients = clients.filter((c) => {
    if (statusFilter === 'ACTIVE' && !c.isActive) return false;
    if (statusFilter === 'INACTIVE' && c.isActive) return false;
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      !!c.clientCode?.toLowerCase().includes(query) ||
      !!c.email?.toLowerCase().includes(query) ||
      !!c.contacts?.some(
        (ct) => ct.name.toLowerCase().includes(query) || ct.email.toLowerCase().includes(query),
      )
    );
  });

  return (
    <div className="space-y-4">
      {/* ——— Header ——— */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">Client Master</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Building size={12} /> Manage client organizations and their contact details
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Add Client
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* ——— Toolbar: same search + filter pattern as the other modules ——— */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code or email…"
                aria-label="Search clients"
                className="h-8 w-52 sm:w-72 rounded-md border border-border bg-background pl-8 pr-7 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex rounded-md border border-border overflow-hidden">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-2.5 h-8 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {hasActiveQuery
              ? `Showing ${filteredClients.length} of ${clients.length}`
              : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`}
          </p>
        </div>

        <div className="p-3">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary/40" /></div>
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                {hasActiveQuery ? <Search size={16} /> : <Building size={16} />}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasActiveQuery ? 'No clients match your search or filter.' : 'No clients yet.'}
              </p>
              {hasActiveQuery && (
                <button
                  onClick={() => { setSearch(''); setStatusFilter('ALL'); }}
                  className="text-xs font-medium text-primary hover:opacity-80 transition-opacity"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => openEdit(client)}
                  className="bg-card border border-border rounded-lg p-3.5 hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                        <Building className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{client.clientCode}</p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(client); }}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                          aria-label={`Edit ${client.name}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}
                          className="p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-muted rounded-md transition-colors"
                          aria-label={`Delete ${client.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${
                        client.isActive
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20'
                          : 'bg-muted text-muted-foreground ring-border'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${client.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                      {client.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-border bg-muted/40 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {client.contacts?.length ?? 0} contact{(client.contacts?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">{modal === 'create' ? 'Add New Client' : 'Edit Client'}</h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Save failures surface here — the page-level banner sits behind this modal. */}
              {error && (
                <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
                  <p>{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Client Name *</label>
                  <input
                    required
                    className={inputCls()}
                    value={current.name || ''}
                    onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Contact Person</label>
                  <input
                    className={inputCls()}
                    value={current.contactPerson || ''}
                    onChange={(e) => setCurrent({ ...current, contactPerson: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Email</label>
                  <input
                    type="email"
                    className={inputCls()}
                    value={current.email || ''}
                    onChange={(e) => setCurrent({ ...current, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Phone</label>
                  <input
                    className={inputCls()}
                    value={current.phone || ''}
                    onChange={(e) => setCurrent({ ...current, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">GSTIN</label>
                  <input
                    className={inputCls()}
                    value={current.gstin || ''}
                    onChange={(e) => setCurrent({ ...current, gstin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">PAN</label>
                  <input
                    className={inputCls()}
                    value={current.pan || ''}
                    onChange={(e) => setCurrent({ ...current, pan: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Address</label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={current.address || ''}
                  onChange={(e) => setCurrent({ ...current, address: e.target.value })}
                />
              </div>

              <div className="pt-2 border-t border-border">
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Contacts</label>
                <p className="text-xs text-muted-foreground mb-2">Add one or more named contacts, each with a unique email address.</p>

                {contacts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {contacts.map((c) => (
                      <span
                        key={c.email}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 pl-2.5 pr-1.5 py-1 text-xs font-medium text-foreground"
                      >
                        {c.name} <span className="text-muted-foreground font-normal">&lt;{c.email}&gt;</span>
                        <button
                          type="button"
                          onClick={() => removeContact(c.email)}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                          aria-label={`Remove ${c.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={contactNameRef}
                    className={inputCls()}
                    placeholder="Contact name"
                    value={contactName}
                    onChange={(e) => { setContactName(e.target.value); setContactError(''); }}
                  />
                  <input
                    type="email"
                    className={inputCls()}
                    placeholder="Contact email"
                    value={contactEmail}
                    onChange={(e) => { setContactEmail(e.target.value); setContactError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContact(); } }}
                  />
                  <button
                    type="button"
                    onClick={addContact}
                    className="shrink-0 flex items-center gap-1 px-3 h-10 rounded-md border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
                {contactError && <p className="text-xs text-red-600 mt-1.5">{contactError}</p>}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  checked={current.isActive ?? true}
                  onChange={(e) => setCurrent({ ...current, isActive: e.target.checked })}
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-foreground">Active Client</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
