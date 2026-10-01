'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Loader2, X, Check, Calendar, FolderKanban, Filter, Search } from 'lucide-react';
import { useProjectStore } from '@/lib/store/project';
import { useAuthStore } from '@/lib/store/auth';
import { projectsApi, Project, ProjectType } from '@/lib/projects-api';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useDebounce } from '@/lib/hooks/useDebounce';


// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectForm {
  name: string;
  description: string;
  type: ProjectType;
  startDate: string;
  endDate: string;
  status: string;
  clientId: string;
  pmId: string;
  methodology: string;
  budgetHours: string;
  budgetCost: string;
  revenue: string;
  isInternal: boolean;
  slaType: string;
}

const defaultForm: ProjectForm = {
  name: '',
  description: '',
  type: ProjectType.DEVELOPMENT,
  startDate: '',
  endDate: '',
  status: 'DRAFT',
  clientId: '',
  pmId: '',
  methodology: 'AGILE',
  budgetHours: '',
  budgetCost: '',
  revenue: '',
  isInternal: false,
  slaType: '',
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-border',
  APPROVED: 'bg-purple-50 text-purple-700 border-purple-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ON_HOLD: 'bg-amber-50 text-amber-700 border-amber-200',
  CLOSED: 'bg-blue-50 text-blue-700 border-blue-200',
  ARCHIVED: 'bg-muted text-muted-foreground border-slate-200',
  CANCELLED: 'bg-red-50 text-red-500 border-red-200',
  INACTIVE: 'bg-slate-100 text-slate-600 border-slate-300',
  // legacy
  PLANNING: 'bg-purple-50 text-purple-700 border-purple-200',
  COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('px-1.5 py-0.5 rounded-md text-xs font-bold border uppercase tracking-tighter', STATUS_STYLES[status] ?? STATUS_STYLES.ACTIVE)}>
      {status}
    </span>
  );
}

// ─── Project Form Modal ───────────────────────────────────────────────────────

function ProjectModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Project;
  onSave: (form: ProjectForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProjectForm>(
    initial
      ? {
        name: initial.name,
        description: initial.description ?? '',
        type: initial.type,
        startDate: initial.startDate.split('T')[0],
        endDate: initial.endDate ? initial.endDate.split('T')[0] : '',
        status: initial.status ?? 'DRAFT',
        clientId: initial.clientId ?? '',
        pmId: initial.pmId ?? '',
        methodology: initial.methodology ?? 'AGILE',
        budgetHours: initial.budgetHours != null ? String(initial.budgetHours) : '',
        budgetCost: initial.budgetCost != null ? String(initial.budgetCost) : '',
        revenue: initial.revenue != null ? String(initial.revenue) : '',
        isInternal: initial.isInternal ?? false,
        slaType: initial.slaType ?? '',
      }
      : defaultForm,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<{ id: string; clientCode: string; name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; firstName?: string; lastName?: string }[]>([]);

  useEffect(() => {
    api.get('/clients').then(({ data }) => setClients(data)).catch(() => { });
    api.get('/users/managers').then(({ data }) => setManagers(data)).catch(() => { });
  }, []);

  async function handleSave() {
    if (!form.name.trim()) { setError('Project name is required.'); return; }
    if (!form.startDate) { setError('Start date is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof ProjectForm>(key: K, val: ProjectForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-base">{initial ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        {error && <p className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

        <div className="space-y-3.5">
          {/* Name */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Project Name *</label>
            <input
              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Customer Portal v2"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-xs bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Type *</label>
              <select
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.type}
                onChange={(e) => set('type', e.target.value as ProjectType)}
              >
                <option value={ProjectType.DEVELOPMENT}>Development</option>
                <option value={ProjectType.MAINTENANCE}>Maintenance</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
              <select
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {['DRAFT', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'CLOSED', 'ARCHIVED', 'CANCELLED', 'INACTIVE'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Client + PM */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Client</label>
              <select
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.clientId}
                onChange={(e) => set('clientId', e.target.value)}
              >
                <option value="">-- No Client (Internal) --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.clientCode} — {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Project Manager</label>
              <select
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.pmId}
                onChange={(e) => set('pmId', e.target.value)}
              >
                <option value="">-- Unassigned --</option>
                {managers.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Methodology + SLA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Methodology</label>
              <div className="flex gap-1">
                {(['AGILE', 'WATERFALL', 'HYBRID'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('methodology', m)}
                    className={cn(
                      'flex-1 py-1 text-xs font-bold rounded-md border transition-colors',
                      form.methodology === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {m.charAt(0) + m.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">SLA Type</label>
              <select
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.slaType}
                onChange={(e) => set('slaType', e.target.value)}
              >
                <option value="">-- None --</option>
                <option value="8x5">8×5</option>
                <option value="24x7">24×7</option>
                <option value="Business Hours">Business Hours</option>
              </select>
            </div>
          </div>

          {/* Internal toggle */}
          <div className="flex items-center gap-2.5 py-1">
            <button
              type="button"
              onClick={() => set('isInternal', !form.isInternal)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors',
                form.isInternal ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full shadow transition-transform',
                form.isInternal ? 'translate-x-4' : 'translate-x-0',
              )} />
            </button>
            <label className="text-xs font-medium cursor-pointer" onClick={() => set('isInternal', !form.isInternal)}>
              Internal project {form.isInternal ? '(no client billing)' : '(client-facing)'}
            </label>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Start Date *</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">End Date</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </div>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Budget Hours</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.budgetHours}
                onChange={(e) => set('budgetHours', e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Budget Cost (₹)</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.budgetCost}
                onChange={(e) => set('budgetCost', e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Revenue (₹)</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.revenue}
                onChange={(e) => set('revenue', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold rounded-lg border hover:bg-secondary transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {initial ? 'Update' : 'Create'} Project
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; item?: Project }>({ open: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string; clientCode: string }[]>([]);

  // Debounce search — waits 300ms after user stops typing before firing API
  const debouncedSearch = useDebounce(filterSearch, 300);

  // Show search box only for roles that can see multiple projects (RA-level and above)
  const canSearchProjects = user && !['USER', 'FREELANCER'].includes(user.role);

  const { setCurrentProject } = useProjectStore();
  const router = useRouter();

  useEffect(() => {
    api.get('/clients').then(({ data }) => setClients(data)).catch(() => { });
  }, []);

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setFilterLoading(true);
    }
    try {
      const data = await projectsApi.getAll({
        status: filterStatus || undefined,
        type: filterType || undefined,
        clientId: filterClientId || undefined,
        search: debouncedSearch || undefined,
      });
      setProjects(data);
    } finally {
      setLoading(false);
      setFilterLoading(false);
    }
  }, [filterStatus, filterType, filterClientId, debouncedSearch]);

  // Initial load
  useEffect(() => { load(true); }, []);

  // Reload on filter changes (not initial)
  useEffect(() => { load(); }, [load]);

  async function handleSave(form: ProjectForm) {
    const payload: any = {
      ...form,
      clientId: form.clientId || undefined,
      pmId: form.pmId || undefined,
      slaType: form.slaType || undefined,
      budgetHours: form.budgetHours ? Number(form.budgetHours) : undefined,
      budgetCost: form.budgetCost ? Number(form.budgetCost) : undefined,
      revenue: form.revenue ? Number(form.revenue) : undefined,
    };

    if (modal.item) {
      await api.patch(`/projects/${modal.item.id}`, payload);
    } else {
      await api.post('/projects', payload);
    }
    setModal({ open: false });
    await load();
  }

  async function handleDelete(id: string) {
    await api.delete(`/projects/${id}`);
    setDeleteId(null);
    await load();
  }

  function handleOpen(project: Project) {
    setCurrentProject(project);
    router.push(`/projects/${project.id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-black tracking-tight uppercase">Projects</h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1.5">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
        </div>
        <PermissionGuard permission="PROJECT_CREATE" allowReportingAuthority>
          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={14} /> New Project
          </button>
        </PermissionGuard>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 border rounded-lg">
        <Filter size={13} className="text-muted-foreground shrink-0" />
        {canSearchProjects && (
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search by project name..."
              className="border rounded-lg pl-7 pr-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 w-56"
            />
          </div>
        )}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
        >
          <option value="">All Statuses</option>
          {['DRAFT', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'CLOSED', 'ARCHIVED', 'CANCELLED', 'INACTIVE'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
        >
          <option value="">All Types</option>
          <option value="DEVELOPMENT">Development</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
        {clients.length > 0 && (
          <select
            value={filterClientId}
            onChange={e => setFilterClientId(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All Clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.clientCode} — {c.name}</option>
            ))}
          </select>
        )}
        {(filterStatus || filterType || filterClientId || filterSearch) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterType(''); setFilterClientId(''); setFilterSearch(''); }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border rounded-lg bg-background transition-colors"
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {/* Cards area with filter-loading overlay */}
      <div className="relative">
        {filterLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-xl">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-xl text-center">
            <FolderKanban size={40} className="text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No projects yet</p>
            <PermissionGuard permission="PROJECT_CREATE">
              <button onClick={() => setModal({ open: true })} className="mt-3 text-sm text-primary hover:underline">
                Create your first project
              </button>
            </PermissionGuard>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-card border rounded-xl p-5 hover:shadow-md hover:border-primary/40 transition-all group cursor-pointer relative"
                onClick={() => handleOpen(project)}
              >
                <PermissionGuard permission="PROJECT_CREATE">
                  <div
                    className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setModal({ open: true, item: project })}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(project.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </PermissionGuard>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-tighter',
                    project.type === ProjectType.DEVELOPMENT ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700',
                  )}>
                    {project.type}
                  </span>
                  <StatusBadge status={project.status ?? 'DRAFT'} />
                  {project.isInternal && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-tighter bg-muted text-muted-foreground">
                      Internal
                    </span>
                  )}
                  {project.methodology && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-tighter bg-blue-50 text-blue-600">
                      {project.methodology}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors pr-12">{project.name}</h3>
                {project.client && (
                  <p className="text-xs font-bold text-muted-foreground mb-1">{project.client.clientCode} — {project.client.name}</p>
                )}
                {project.description && (
                  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                )}

                {(project.budgetCost != null || project.revenue != null) && (
                  <div className="flex gap-3 mb-3 text-xs font-bold">
                    {project.budgetCost != null && (
                      <span className="text-muted-foreground">Budget: ₹{project.budgetCost.toLocaleString('en-IN')}</span>
                    )}
                    {project.revenue != null && (
                      <span className="text-emerald-600">Rev: ₹{project.revenue.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground/60 mt-auto">
                  <Calendar size={10} />
                  <span>{new Date(project.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {project.endDate && (
                    <>
                      <span>→</span>
                      <span>{new Date(project.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal.open && (
        <ProjectModal initial={modal.item} onSave={handleSave} onClose={() => setModal({ open: false })} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-semibold text-lg mb-2">Delete Project?</h2>
            <p className="text-sm text-muted-foreground mb-6">This will permanently delete the project and all associated tasks, tickets, and timesheets.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}