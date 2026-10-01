'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, X, Users, Building, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  projectRecipientsApi,
  ProjectRecipientsData,
  RecipientRole,
} from '@/lib/project-recipients-api';

function RolePill({ role, onChange }: { role: RecipientRole; onChange: (r: RecipientRole) => void }) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden shrink-0">
      {(['TO', 'CC'] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            'px-2 py-0.5 text-[11px] font-medium transition-colors',
            role === r ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted',
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export default function RecipientsModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [data, setData] = useState<ProjectRecipientsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [contacts, setContacts] = useState<Record<string, RecipientRole>>({});
  const [users, setUsers] = useState<Record<string, RecipientRole>>({});
  const [query, setQuery] = useState('');
  /** Keeps already-selected people visible even when they fall outside the search. */
  const [selectedOnly, setSelectedOnly] = useState(false);

  useEffect(() => {
    projectRecipientsApi
      .get(projectId)
      .then((d) => {
        setData(d);
        setContacts(Object.fromEntries(d.mappedClientContacts.map((m) => [m.clientContactId, m.role])));
        setUsers(Object.fromEntries(d.mappedInternalUsers.map((m) => [m.userId, m.role])));
      })
      .catch(() => setError('Failed to load recipients'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const toggleContact = (id: string) =>
    setContacts((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 'TO';
      return next;
    });

  const toggleUser = (id: string) =>
    setUsers((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 'TO';
      return next;
    });

  const q = query.trim().toLowerCase();

  const visibleContacts = useMemo(
    () =>
      (data?.clientContacts ?? []).filter((c) => {
        if (selectedOnly && !contacts[c.id]) return false;
        return !q || `${c.name} ${c.email}`.toLowerCase().includes(q);
      }),
    [data?.clientContacts, q, selectedOnly, contacts],
  );

  const visibleUsers = useMemo(
    () =>
      (data?.internalUsers ?? []).filter((u) => {
        if (selectedOnly && !users[u.userId]) return false;
        return !q || `${u.name} ${u.email}`.toLowerCase().includes(q);
      }),
    [data?.internalUsers, q, selectedOnly, users],
  );

  const selectedCount = Object.keys(contacts).length + Object.keys(users).length;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await projectRecipientsApi.set(projectId, {
        clientContacts: Object.entries(contacts).map(([id, role]) => ({ id, role })),
        internalUsers: Object.entries(users).map(([id, role]) => ({ id, role })),
      });
      onClose();
    } catch {
      setError('Failed to save recipients. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Report Recipients</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedCount} selected
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        {!loading && (
          <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                aria-label="Search recipients"
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-7 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedOnly((v) => !v)}
              aria-pressed={selectedOnly}
              className={cn(
                'h-8 px-2.5 rounded-md border text-xs font-medium transition-colors shrink-0',
                selectedOnly
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              Selected only
            </button>
          </div>
        )}

        <div className="p-5 space-y-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {error && <p className="text-sm text-red-500">{error}</p>}

              {/* Client contacts */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Building size={13} className="text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground">
                    {data?.client ? `${data.client.name} — Client Contacts` : 'Client Contacts'}
                  </h3>
                </div>
                {!data?.client ? (
                  <p className="text-xs text-muted-foreground italic">This project isn&apos;t linked to a client yet.</p>
                ) : data.clientContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">This client has no contacts yet.</p>
                ) : visibleContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No contacts match your search.</p>
                ) : (
                  <div className="space-y-0.5">
                    {visibleContacts.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-xs px-1.5 py-1.5 -mx-1.5 rounded-md hover:bg-muted/60 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!contacts[c.id]}
                          onChange={() => toggleContact(c.id)}
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{c.name}</p>
                          <p className="text-muted-foreground truncate">{c.email}</p>
                        </div>
                        {contacts[c.id] && (
                          <RolePill role={contacts[c.id]} onChange={(r) => setContacts((p) => ({ ...p, [c.id]: r }))} />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Internal users */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users size={13} className="text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground">Internal Users</h3>
                </div>
                {visibleUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {data?.internalUsers.length ? 'No users match your search.' : 'No internal users available.'}
                  </p>
                ) : (
                  <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1">
                    {visibleUsers.map((u) => (
                      <label
                        key={u.userId}
                        className="flex items-center gap-2 text-xs px-1.5 py-1.5 -mx-1.5 rounded-md hover:bg-muted/60 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!users[u.userId]}
                          onChange={() => toggleUser(u.userId)}
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{u.name}</p>
                          <p className="text-muted-foreground truncate">{u.email}</p>
                        </div>
                        {users[u.userId] && (
                          <RolePill role={users[u.userId]} onChange={(r) => setUsers((p) => ({ ...p, [u.userId]: r }))} />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || loading} className="btn btn-primary text-sm flex items-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
