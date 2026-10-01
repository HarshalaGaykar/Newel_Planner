'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Search, X, Check } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Department { id: string; name: string; description?: string }
interface Skill       { id: string; name: string; description?: string }
interface Permission  { id: string; name: string; description?: string }
interface Role        { id: string; name: string; description?: string; permissions: { permission: Permission }[] }
interface Holiday     { id: string; name: string; date: string; isGlobal: boolean }

type Tab = 'departments' | 'skills' | 'roles' | 'holidays';

function MasterRow({ label, description, onEdit, onDelete }: {
  label: string; description?: string; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-card border rounded-lg hover:border-primary/40 transition-colors group">
      <div className="min-w-0">
        <p className="font-medium text-xs truncate">{label}</p>
        {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
        <button onClick={onEdit} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Pencil size={12} />
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function StringModal({ title, fields, values, onChange, onSave, onClose, saving }: {
  title: string;
  fields: { key: string; label: string; required?: boolean; textarea?: boolean }[];
  values: Record<string, string>;
  onChange: (k: string, v: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border rounded-lg p-4 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="form-label">{f.label}</label>
              {f.textarea ? (
                <textarea className="field-textarea" rows={3} value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} />
              ) : (
                <input className="field-input" value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DepartmentsTab() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; item?: Department }>({ open: false });
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<Department[]>('/departments');
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ name: '', description: '' }); setModal({ open: true }); }
  function openEdit(d: Department) { setForm({ name: d.name, description: d.description ?? '' }); setModal({ open: true, item: d }); }

  async function handleSave() {
    setSaving(true);
    try {
      if (modal.item) { await api.patch(`/departments/${modal.item.id}`, form); } else { await api.post('/departments', form); }
      await load(); setModal({ open: false });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this department?')) return;
    await api.delete(`/departments/${id}`); await load();
  }

  const filtered = items.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="field-input pl-8" placeholder="Search departments..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={12} /> Add</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground/40" /></div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((d) => <MasterRow key={d.id} label={d.name} description={d.description} onEdit={() => openEdit(d)} onDelete={() => handleDelete(d.id)} />)}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No departments found.</p>}
        </div>
      )}
      {modal.open && (
        <StringModal title={modal.item ? 'Edit Department' : 'New Department'}
          fields={[{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', textarea: true }]}
          values={form} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
          onSave={handleSave} onClose={() => setModal({ open: false })} saving={saving} />
      )}
    </div>
  );
}

function SkillsTab() {
  const [items, setItems] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; item?: Skill }>({ open: false });
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<Skill[]>('/skills');
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ name: '', description: '' }); setModal({ open: true }); }
  function openEdit(s: Skill) { setForm({ name: s.name, description: s.description ?? '' }); setModal({ open: true, item: s }); }

  async function handleSave() {
    setSaving(true);
    try {
      if (modal.item) { await api.patch(`/skills/${modal.item.id}`, form); } else { await api.post('/skills', form); }
      await load(); setModal({ open: false });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this skill?')) return;
    await api.delete(`/skills/${id}`); await load();
  }

  const filtered = items.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="field-input pl-8" placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={12} /> Add</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground/40" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {filtered.map((s) => <MasterRow key={s.id} label={s.name} description={s.description} onEdit={() => openEdit(s)} onDelete={() => handleDelete(s.id)} />)}
          {filtered.length === 0 && <p className="col-span-2 text-xs text-muted-foreground text-center py-6">No skills found.</p>}
        </div>
      )}
      {modal.open && (
        <StringModal title={modal.item ? 'Edit Skill' : 'New Skill'}
          fields={[{ key: 'name', label: 'Skill Name', required: true }, { key: 'description', label: 'Description', textarea: true }]}
          values={form} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
          onSave={handleSave} onClose={() => setModal({ open: false })} saving={saving} />
      )}
    </div>
  );
}

function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item?: Role }>({ open: false });
  const [form, setForm] = useState({ name: '', description: '', permissionIds: [] as string[] });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, p] = await Promise.all([api.get<Role[]>('/roles'), api.get<Permission[]>('/permissions')]);
    setRoles(r.data); setPerms(p.data); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ name: '', description: '', permissionIds: [] }); setModal({ open: true }); }
  function openEdit(r: Role) {
    setForm({ name: r.name, description: r.description ?? '', permissionIds: r.permissions.map((p) => p.permission.id) });
    setModal({ open: true, item: r });
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (modal.item) { await api.patch(`/roles/${modal.item.id}`, form); } else { await api.post('/roles', form); }
      await load(); setModal({ open: false });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this role? This will fail if users are assigned to it.')) return;
    await api.delete(`/roles/${id}`); await load();
  }

  function togglePerm(id: string) {
    setForm((f) => ({ ...f, permissionIds: f.permissionIds.includes(id) ? f.permissionIds.filter((p) => p !== id) : [...f.permissionIds, id] }));
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary"><Plus size={12} /> New Role</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground/40" /></div>
      ) : (
        <div className="space-y-1.5">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-card border rounded-lg hover:border-primary/40 transition-colors group">
              <div>
                <p className="font-medium text-xs">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.permissions.length} permission(s)</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border rounded-lg p-4 w-full max-w-xl shadow-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-sm">{modal.item ? 'Edit Role' : 'New Role'}</h2>
              <button onClick={() => setModal({ open: false })} className="p-1 hover:bg-muted rounded"><X size={14} /></button>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="form-label">Role Name</label>
                <input className="field-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea className="field-textarea" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Permissions</label>
                <div className="space-y-0.5 max-h-40 overflow-y-auto border rounded-lg p-2">
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs">
                      <input type="checkbox" checked={form.permissionIds.includes(p.id)} onChange={() => togglePerm(p.id)} className="rounded" />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
              <button onClick={() => setModal({ open: false })} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HolidaysTab() {
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [modal, setModal] = useState<{ open: boolean; item?: Holiday }>({ open: false });
  const [form, setForm] = useState({ name: '', date: '', isGlobal: 'true' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<Holiday[]>(`/public-holidays?year=${year}`);
    setItems(data); setLoading(false);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ name: '', date: '', isGlobal: 'true' }); setModal({ open: true }); }
  function openEdit(h: Holiday) {
    setForm({ name: h.name, date: h.date.split('T')[0], isGlobal: String(h.isGlobal) });
    setModal({ open: true, item: h });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form, isGlobal: form.isGlobal === 'true' };
      if (modal.item) { await api.patch(`/public-holidays/${modal.item.id}`, payload); } else { await api.post('/public-holidays', payload); }
      await load(); setModal({ open: false });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this holiday?')) return;
    await api.delete(`/public-holidays/${id}`); await load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5">
          <label className="text-xs font-medium">Year:</label>
          <select className="text-xs bg-transparent focus:outline-none" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={openCreate} className="btn-primary ml-auto"><Plus size={12} /> Add Holiday</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground/40" /></div>
      ) : (
        <div className="space-y-1.5">
          {items.map((h) => (
            <MasterRow key={h.id} label={h.name}
              description={`${new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · ${h.isGlobal ? 'Global' : 'Regional'}`}
              onEdit={() => openEdit(h)} onDelete={() => handleDelete(h.id)} />
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No holidays for {year}.</p>}
        </div>
      )}
      {modal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border rounded-lg p-4 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-sm">{modal.item ? 'Edit Holiday' : 'New Holiday'}</h2>
              <button onClick={() => setModal({ open: false })} className="p-1 hover:bg-muted rounded"><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="form-label">Holiday Name</label><input className="field-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="form-label">Date</label><input type="date" className="field-input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
              <div>
                <label className="form-label">Scope</label>
                <select className="field-select" value={form.isGlobal} onChange={(e) => setForm((f) => ({ ...f, isGlobal: e.target.value }))}>
                  <option value="true">Global (All Employees)</option>
                  <option value="false">Regional</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal({ open: false })} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'departments', label: 'Departments' },
  { id: 'skills',      label: 'Skills' },
  { id: 'roles',       label: 'Roles' },
  { id: 'holidays',    label: 'Public Holidays' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('departments');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold">Admin — Master Data</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage reference data used across the system.</p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
              activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'skills'      && <SkillsTab />}
        {activeTab === 'roles'       && <RolesTab />}
        {activeTab === 'holidays'    && <HolidaysTab />}
      </div>
    </div>
  );
}
