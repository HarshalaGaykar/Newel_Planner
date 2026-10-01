'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap, Plus, Edit2, Trash2, AlertCircle, Search, Filter,
  BookOpen, CalendarDays, Users, Clock, MapPin, Link2, CheckCircle2,
  XCircle, AlertTriangle, ChevronRight, X, Loader2, Award, Star,
  MessageSquare, BarChart2,
} from 'lucide-react';
import { trainingApi, TrainingCategory, TrainingProgram, TrainingSession, TrainingEnrollment, TrainingCertificate, SessionFeedbackSummary, TrainingType, TrainingMode, SessionStatus, EnrollmentStatus } from '@/lib/training-api';
import { adminApi } from '@/lib/admin-api';
import { usersApi, User } from '@/lib/users-api';
import { useAuthStore } from '@/lib/store/auth';
import { MultiSelect, Option } from '@/components/ui/MultiSelect';
import { CertificateModal } from '@/components/training/CertificateModal';
import { usePermission } from '@/lib/hooks/usePermission';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// ── helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TrainingType, string> = {
  INTERNAL: 'Internal',
  EXTERNAL: 'External',
  ONLINE: 'Online',
  CERTIFICATION: 'Certification',
};

const TYPE_COLORS: Record<TrainingType, string> = {
  INTERNAL: 'bg-blue-100 text-blue-700',
  EXTERNAL: 'bg-purple-100 text-purple-700',
  ONLINE: 'bg-green-100 text-green-700',
  CERTIFICATION: 'bg-amber-100 text-amber-700',
};

const MODE_LABELS: Record<TrainingMode, string> = {
  ONLINE: 'Online',
  OFFLINE: 'In-Person',
  HYBRID: 'Hybrid',
};

const SESSION_STATUS_COLOR: Record<SessionStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  ONGOING: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
};

const ENROLLMENT_STATUS_COLOR: Record<EnrollmentStatus, string> = {
  ENROLLED: 'bg-blue-100 text-blue-700',
  WAITLISTED: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  NO_SHOW: 'bg-red-100 text-red-600',
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inputCls() {
  return 'w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
}

// ── PROGRAMS TAB ──────────────────────────────────────────────────────────────

function ProgramsTab({ onBrowseSessions }: { onBrowseSessions?: (programId: string) => void }) {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [skills, setSkills] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<TrainingType | ''>('');
  const [filterCat, setFilterCat] = useState('');

  // modal
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<TrainingProgram> & { skillIds?: string[] }>({});
  const [saving, setSaving] = useState(false);
  const { user } = useAuthStore();
  const { can } = usePermission();
  const isAdmin = can('TRAINING_MANAGE');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [p, c, s] = await Promise.all([
        trainingApi.getPrograms({
          search: search || undefined,
          type: filterType || undefined,
          categoryId: filterCat || undefined,
        }),
        trainingApi.getCategories(),
        adminApi.getSkills(),
      ]);
      setPrograms(p);
      setCategories(c);
      setSkills(s);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterCat]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCurrent({ type: 'INTERNAL', durationHrs: 8, skillIds: [] });
    setModal('create');
  };

  const openEdit = (p: TrainingProgram) => {
    setCurrent({ ...p, skillIds: p.skills.map((s) => s.skillId) });
    setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name || !current.type || !current.durationHrs) return;
    try {
      setSaving(true);
      if (modal === 'edit' && current.id) {
        await trainingApi.updateProgram(current.id, {
          name: current.name,
          description: current.description ?? undefined,
          type: current.type,
          categoryId: current.categoryId ?? undefined,
          durationHrs: current.durationHrs,
          skillIds: current.skillIds,
        });
      } else {
        await trainingApi.createProgram({
          name: current.name!,
          description: current.description ?? undefined,
          type: current.type!,
          categoryId: current.categoryId ?? undefined,
          durationHrs: current.durationHrs!,
          skillIds: current.skillIds,
        });
      }
      setModal(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this training program?')) return;
    try {
      await trainingApi.deleteProgram(id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete');
    }
  };

  const toggleSkill = (skillId: string) => {
    const ids = current.skillIds ?? [];
    setCurrent({ ...current, skillIds: ids.includes(skillId) ? ids.filter((s) => s !== skillId) : [...ids, skillId] });
  };

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 pl-8 pr-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring w-52"
              placeholder="Search programs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-9 px-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
          >
            <option value="">All Types</option>
            {(Object.keys(TYPE_LABELS) as TrainingType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            className="h-9 px-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={16} /> New Program
          </button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : programs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No programs found</p>
          <p className="text-sm mt-1">Create your first training program to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {programs.map((p) => (
            <div key={p.id} className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[p.type]}`}>
                      {TYPE_LABELS[p.type]}
                    </span>
                    {p.category && (
                      <span className="text-xs text-muted-foreground border rounded-full px-2 py-0.5">
                        {p.category.name}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm leading-snug">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock size={12} /> {p.durationHrs}h</span>
                <span className="flex items-center gap-1"><CalendarDays size={12} /> {p._count?.sessions ?? 0} sessions</span>
              </div>
              {p.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.skills.slice(0, 4).map((s) => (
                    <span key={s.skillId} className="text-xs bg-muted px-2 py-0.5 rounded-full">{s.skill.name}</span>
                  ))}
                  {p.skills.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{p.skills.length - 4} more</span>
                  )}
                </div>
              )}
              {!isAdmin && (p._count?.sessions ?? 0) > 0 && (
                <button
                  onClick={() => onBrowseSessions?.(p.id)}
                  className="mt-4 w-full text-xs font-semibold py-2 border rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-primary"
                >
                  <CalendarDays size={14} /> Browse Sessions & Enroll
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{modal === 'edit' ? 'Edit Program' : 'New Training Program'}</h2>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1">Program Name *</label>
                <input
                  required
                  className={inputCls()}
                  placeholder="e.g. Advanced React Development"
                  value={current.name ?? ''}
                  onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select
                    required
                    className={inputCls()}
                    value={current.type ?? 'INTERNAL'}
                    onChange={(e) => setCurrent({ ...current, type: e.target.value as TrainingType })}
                  >
                    {(Object.keys(TYPE_LABELS) as TrainingType[]).map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (hours) *</label>
                  <input
                    required
                    type="number"
                    min={0.5}
                    step={0.5}
                    className={inputCls()}
                    value={current.durationHrs ?? ''}
                    onChange={(e) => setCurrent({ ...current, durationHrs: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  className={inputCls()}
                  value={current.categoryId ?? ''}
                  onChange={(e) => setCurrent({ ...current, categoryId: e.target.value || undefined })}
                >
                  <option value="">— None —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="What will participants learn?"
                  value={current.description ?? ''}
                  onChange={(e) => setCurrent({ ...current, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Linked Skills</label>
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-1">
                  {skills.map((s) => {
                    const selected = current.skillIds?.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSkill(s.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          selected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted border-input'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? 'Saving…' : 'Save Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SESSIONS TAB ──────────────────────────────────────────────────────────────

function SessionsTab({ initialProgramId }: { initialProgramId?: string }) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterProgram, setFilterProgram] = useState(initialProgramId || '');
  const [filterStatus, setFilterStatus] = useState<SessionStatus | ''>('');

  // create/edit modal
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<TrainingSession>>({});
  const [saving, setSaving] = useState(false);

  // enroll modal
  const [enrollSession, setEnrollSession] = useState<TrainingSession | null>(null);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [enrollUserIds, setEnrollUserIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);

  // feedback summary modal
  const [feedbackSummary, setFeedbackSummary] = useState<{ session: TrainingSession; data: SessionFeedbackSummary } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const { can } = usePermission();
  const isAdmin = can('TRAINING_MANAGE');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [s, p, u] = await Promise.all([
        trainingApi.getSessions({
          programId: filterProgram || undefined,
          status: filterStatus || undefined,
        }),
        trainingApi.getPrograms(),
        isAdmin ? usersApi.getUsers() : Promise.resolve([]),
      ]);
      setSessions(s);
      setPrograms(p);
      setAllUsers(u as User[]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [filterProgram, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCurrent({ mode: 'OFFLINE', status: 'SCHEDULED' });
    setModal('create');
  };

  const openEdit = (s: TrainingSession) => {
    setCurrent({
      ...s,
      startDate: s.startDate.slice(0, 16),
      endDate: s.endDate.slice(0, 16),
    });
    setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.programId || !current.startDate || !current.endDate || !current.mode) return;
    try {
      setSaving(true);
      if (modal === 'edit' && current.id) {
        await trainingApi.updateSession(current.id, {
          title: current.title ?? undefined,
          startDate: current.startDate,
          endDate: current.endDate,
          mode: current.mode,
          venue: current.venue ?? undefined,
          meetingUrl: current.meetingUrl ?? undefined,
          maxCapacity: current.maxCapacity ?? undefined,
          status: current.status,
        } as any);
      } else {
        await trainingApi.createSession({
          programId: current.programId!,
          title: current.title ?? undefined,
          startDate: current.startDate!,
          endDate: current.endDate!,
          mode: current.mode!,
          venue: current.venue ?? undefined,
          meetingUrl: current.meetingUrl ?? undefined,
          maxCapacity: current.maxCapacity ?? undefined,
          trainerId: current.trainerId ?? undefined,
        });
      }
      setModal(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save session');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    try {
      await trainingApi.deleteSession(id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete');
    }
  };

  const openEnroll = async (s: TrainingSession) => {
    setEnrollSession(s);
    setEnrollLoading(true);
    try {
      const e = await trainingApi.getSessionEnrollments(s.id);
      setEnrollments(e);
    } catch {
      setEnrollments([]);
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollSession) return;
    if (!enrollUserIds.length) return;
    try {
      setEnrollLoading(true);
      await trainingApi.enroll(enrollSession.id, enrollUserIds);
      const updated = await trainingApi.getSessionEnrollments(enrollSession.id);
      setEnrollments(updated);
      setEnrollUserIds([]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to enroll');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleStatusChange = async (enrollmentId: string, status: EnrollmentStatus) => {
    try {
      await trainingApi.updateEnrollment(enrollmentId, { status });
      const updated = await trainingApi.getSessionEnrollments(enrollSession!.id);
      setEnrollments(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update');
    }
  };

  const openFeedbackSummary = async (s: TrainingSession) => {
    setFeedbackLoading(true);
    try {
      const data = await trainingApi.getSessionFeedback(s.id);
      setFeedbackSummary({ session: s, data });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 px-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
          >
            <option value="">All Programs</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            className="h-9 px-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="">All Statuses</option>
            {(['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'] as SessionStatus[]).map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={16} /> Schedule Session
          </button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No sessions found</p>
          <p className="text-sm mt-1">Schedule a new session from a training program.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-5 py-3 font-medium text-muted-foreground">Program / Title</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Dates</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Mode</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Enrolled</th>
                {isAdmin && <th className="px-5 py-3 font-medium text-muted-foreground w-32">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="font-medium">{s.title || s.program.name}</div>
                    {s.title && <div className="text-xs text-muted-foreground">{s.program.name}</div>}
                    {s.venue && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {s.venue}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <div>{fmt(s.startDate)}</div>
                    <div className="text-xs">→ {fmt(s.endDate)}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs border rounded-full px-2 py-0.5">{MODE_LABELS[s.mode]}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SESSION_STATUS_COLOR[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users size={13} />
                      {s._count?.enrollments ?? 0}
                      {s.maxCapacity ? ` / ${s.maxCapacity}` : ''}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      {isAdmin ? (
                        <>
                          <button
                            onClick={() => openEnroll(s)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Manage Enrollments"
                          >
                            <Users size={14} />
                          </button>
                          {s.status === 'COMPLETED' && (
                            <button
                              onClick={() => openFeedbackSummary(s)}
                              disabled={feedbackLoading}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                              title="View Feedback"
                            >
                              <BarChart2 size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        s.status === 'SCHEDULED' && (
                          <button
                            onClick={async () => {
                              try {
                                await trainingApi.enroll(s.id, []); // Empty array will trigger self-enrollment on backend
                                alert('Successfully enrolled!');
                                load();
                              } catch (e: any) {
                                alert(e?.response?.data?.message || 'Failed to enroll');
                              }
                            }}
                            className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg font-medium hover:opacity-90"
                          >
                            Enroll Now
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Session Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{modal === 'edit' ? 'Edit Session' : 'Schedule Training Session'}</h2>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {modal === 'create' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Program *</label>
                  <select
                    required
                    className={inputCls()}
                    value={current.programId ?? ''}
                    onChange={(e) => setCurrent({ ...current, programId: e.target.value })}
                  >
                    <option value="">Select program…</option>
                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Session Title</label>
                <input
                  className={inputCls()}
                  placeholder="Optional — defaults to program name"
                  value={current.title ?? ''}
                  onChange={(e) => setCurrent({ ...current, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date & Time *</label>
                  <input
                    required
                    type="datetime-local"
                    className={inputCls()}
                    value={current.startDate ?? ''}
                    onChange={(e) => setCurrent({ ...current, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date & Time *</label>
                  <input
                    required
                    type="datetime-local"
                    className={inputCls()}
                    value={current.endDate ?? ''}
                    onChange={(e) => setCurrent({ ...current, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Mode *</label>
                  <select
                    required
                    className={inputCls()}
                    value={current.mode ?? 'OFFLINE'}
                    onChange={(e) => setCurrent({ ...current, mode: e.target.value as TrainingMode })}
                  >
                    <option value="OFFLINE">In-Person</option>
                    <option value="ONLINE">Online</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Capacity</label>
                  <input
                    type="number"
                    min={1}
                    className={inputCls()}
                    placeholder="Unlimited"
                    value={current.maxCapacity ?? ''}
                    onChange={(e) => setCurrent({ ...current, maxCapacity: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
              </div>
              {(current.mode === 'OFFLINE' || current.mode === 'HYBRID') && (
                <div>
                  <label className="block text-sm font-medium mb-1">Venue</label>
                  <input
                    className={inputCls()}
                    placeholder="e.g. Training Room 2, HQ"
                    value={current.venue ?? ''}
                    onChange={(e) => setCurrent({ ...current, venue: e.target.value })}
                  />
                </div>
              )}
              {(current.mode === 'ONLINE' || current.mode === 'HYBRID') && (
                <div>
                  <label className="block text-sm font-medium mb-1">Meeting URL</label>
                  <input
                    type="url"
                    className={inputCls()}
                    placeholder="https://meet.example.com/..."
                    value={current.meetingUrl ?? ''}
                    onChange={(e) => setCurrent({ ...current, meetingUrl: e.target.value })}
                  />
                </div>
              )}
              {modal === 'edit' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    className={inputCls()}
                    value={current.status ?? 'SCHEDULED'}
                    onChange={(e) => setCurrent({ ...current, status: e.target.value as SessionStatus })}
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="ONGOING">Ongoing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {saving ? 'Saving…' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enrollment Management Modal */}
      {enrollSession && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Enrollments</h2>
                <p className="text-sm text-muted-foreground">{enrollSession.title || enrollSession.program.name} · {fmt(enrollSession.startDate)}</p>
              </div>
              <button onClick={() => { setEnrollSession(null); setEnrollUserIds([]); }} className="p-1.5 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Quick enroll by user IDs */}
              <form onSubmit={handleEnroll} className="flex gap-2">
                <div className="flex-1">
                  <MultiSelect
                    options={allUsers.map((u) => ({
                      value: u.id,
                      label: `${u.firstName} ${u.lastName}`,
                      subLabel: u.email,
                    }))}
                    selected={enrollUserIds}
                    onChange={setEnrollUserIds}
                    placeholder="Select users to enroll…"
                  />
                </div>
                <button
                  type="submit"
                  disabled={enrollLoading || enrollUserIds.length === 0}
                  className="px-4 py-2 h-[38px] rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {enrollLoading ? <Loader2 size={14} className="animate-spin" /> : 'Enroll'}
                </button>
              </form>

              {/* Enrollment list */}
              {enrollLoading && enrollments.length === 0 ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : enrollments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No enrollments yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="pb-2 text-left font-medium text-muted-foreground">Employee</th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">Department</th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {enrollments.map((en) => (
                      <tr key={en.id} className="hover:bg-muted/20">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{en.user?.firstName} {en.user?.lastName}</div>
                          <div className="text-xs text-muted-foreground">{en.user?.email}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground text-xs">{en.user?.department?.name ?? '—'}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ENROLLMENT_STATUS_COLOR[en.status]}`}>
                            {en.status}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <select
                            className="h-7 px-2 text-xs border rounded bg-background focus:outline-none"
                            value={en.status}
                            onChange={(e) => handleStatusChange(en.id, e.target.value as EnrollmentStatus)}
                          >
                            {(['ENROLLED', 'WAITLISTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as EnrollmentStatus[]).map((s) => (
                              <option key={s} value={s}>{s.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Summary Modal */}
      {feedbackSummary && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><BarChart2 size={18} /> Feedback Summary</h2>
                <p className="text-sm text-muted-foreground">
                  {feedbackSummary.session.title || feedbackSummary.session.program.name} · {fmt(feedbackSummary.session.startDate)}
                </p>
              </div>
              <button onClick={() => setFeedbackSummary(null)} className="p-1.5 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {feedbackSummary.data.count === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No feedback submitted yet.</div>
              ) : (
                <>
                  {/* Averages */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Overall', value: feedbackSummary.data.avgRating },
                      { label: 'Trainer', value: feedbackSummary.data.avgTrainerRating },
                      { label: 'Content', value: feedbackSummary.data.avgContentRating },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-muted/40 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold">{value ?? '—'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                        {value !== null && (
                          <div className="flex justify-center mt-1.5">
                            <StarRating value={Math.round(value)} readonly />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">{feedbackSummary.data.count} response{feedbackSummary.data.count !== 1 ? 's' : ''}</div>

                  {/* Individual responses */}
                  <div className="space-y-3">
                    {feedbackSummary.data.feedbacks.map((fb) => (
                      <div key={fb.id} className="border rounded-xl p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {fb.user.firstName} {fb.user.lastName}
                          </span>
                          <StarRating value={fb.rating} readonly />
                        </div>
                        {(fb.trainerRating || fb.contentRating) && (
                          <div className="text-xs text-muted-foreground flex gap-4">
                            {fb.trainerRating && <span>Trainer: {'★'.repeat(fb.trainerRating)}{'☆'.repeat(5 - fb.trainerRating)}</span>}
                            {fb.contentRating && <span>Content: {'★'.repeat(fb.contentRating)}{'☆'.repeat(5 - fb.contentRating)}</span>}
                          </div>
                        )}
                        {fb.comments && <p className="text-sm text-muted-foreground italic">"{fb.comments}"</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── STAR RATING ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'hover:text-amber-400'} ${n <= value ? 'text-amber-400' : 'text-muted-foreground/30'}`}
        >
          <Star size={16} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

// ── MY TRAINING TAB ───────────────────────────────────────────────────────────

function MyTrainingTab() {
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // feedback form state per enrollment id
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null);
  const [fbRating, setFbRating] = useState(5);
  const [fbTrainer, setFbTrainer] = useState(0);
  const [fbContent, setFbContent] = useState(0);
  const [fbComments, setFbComments] = useState('');
  const [fbSaving, setFbSaving] = useState(false);
  const [viewCert, setViewCert] = useState<TrainingEnrollment | null>(null);

  const load = () => {
    trainingApi.getMyEnrollments()
      .then(setEnrollments)
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openFeedback = (enrollmentId: string) => {
    setFeedbackOpen(enrollmentId);
    setFbRating(5);
    setFbTrainer(0);
    setFbContent(0);
    setFbComments('');
  };

  const handleFeedbackSubmit = async (e: React.FormEvent, enrollmentId: string) => {
    e.preventDefault();
    try {
      setFbSaving(true);
      await trainingApi.submitFeedback(enrollmentId, {
        rating: fbRating,
        trainerRating: fbTrainer || undefined,
        contentRating: fbContent || undefined,
        comments: fbComments || undefined,
      });
      setFeedbackOpen(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setFbSaving(false);
    }
  };

  const handleStartTraining = async (enrollmentId: string) => {
    try {
      await trainingApi.updateEnrollment(enrollmentId, { status: 'IN_PROGRESS' });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to start training');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  if (error) return (
    <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-sm">
      <AlertCircle size={16} /> {error}
    </div>
  );
  if (enrollments.length === 0) return (
    <div className="text-center py-16 text-muted-foreground">
      <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">No training enrollments yet</p>
      <p className="text-sm mt-1">You will appear here once enrolled in a session.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {enrollments.map((en) => {
        const s = en.session!;
        const p = s.program;
        const isCompleted = en.status === 'COMPLETED';
        const hasCert = !!en.certificate;
        const hasFeedback = !!en.feedback;
        return (
          <div key={en.id} className="bg-card border rounded-xl p-4 flex items-start gap-4">
            <div className={`mt-0.5 px-2 py-1 rounded-full text-xs font-semibold shrink-0 ${TYPE_COLORS[p.type]}`}>
              {TYPE_LABELS[p.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold">{s.title || p.name}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ENROLLMENT_STATUS_COLOR[en.status]}`}>
                  {en.status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                <span className="flex items-center gap-1"><CalendarDays size={12} /> {fmt(s.startDate)} – {fmt(s.endDate)}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {p.durationHrs}h</span>
                {s.venue && <span className="flex items-center gap-1"><MapPin size={12} /> {s.venue}</span>}
                {s.meetingUrl ? (
                  <div className="flex items-center gap-2">
                    <a href={s.meetingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
                      <Link2 size={12} /> Launch Session
                    </a>
                    {en.status === 'ENROLLED' && (
                      <button
                        onClick={() => handleStartTraining(en.id)}
                        className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle2 size={12} /> Mark as In Progress
                      </button>
                    )}
                  </div>
                ) : (
                   <div className="flex items-center gap-3">
                     <span className="flex items-center gap-1 text-muted-foreground italic"><Link2 size={12} /> No link provided</span>
                     {en.status === 'ENROLLED' && (
                       <button
                         onClick={() => handleStartTraining(en.id)}
                         className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-green-700 transition-colors"
                       >
                         <CheckCircle2 size={12} /> Mark as In Progress
                       </button>
                     )}
                   </div>
                )}
              </div>
              {p.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.skills.map((sk) => (
                    <span key={sk.skillId} className="text-xs bg-muted px-2 py-0.5 rounded-full">{sk.skill.name}</span>
                  ))}
                </div>
              )}

              {/* Certificate & Feedback — only for completed enrollments */}
              {isCompleted && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {hasCert && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-1.5 text-xs font-medium">
                        <Award size={13} />
                        <span>Certificate Issued</span>
                        <span className="font-mono text-amber-500">{en.certificate!.certificateNo}</span>
                      </div>
                      <button
                        onClick={() => setViewCert(en)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        View Digital Certificate →
                      </button>
                    </div>
                  )}

                  {hasFeedback ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StarRating value={en.feedback!.rating} readonly />
                      <span>Feedback submitted</span>
                    </div>
                  ) : feedbackOpen === en.id ? (
                    <form
                      onSubmit={(e) => handleFeedbackSubmit(e, en.id)}
                      className="w-full mt-2 bg-muted/40 border rounded-xl p-4 space-y-3"
                    >
                      <div className="font-medium text-sm">Rate this training</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Overall *</label>
                          <StarRating value={fbRating} onChange={setFbRating} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Trainer</label>
                          <StarRating value={fbTrainer} onChange={setFbTrainer} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Content</label>
                          <StarRating value={fbContent} onChange={setFbContent} />
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Any comments? (optional)"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        value={fbComments}
                        onChange={(e) => setFbComments(e.target.value)}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setFeedbackOpen(null)}
                          className="px-3 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={fbSaving || fbRating === 0}
                          className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {fbSaving ? 'Submitting…' : 'Submit Feedback'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => openFeedback(en.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors hover:bg-muted"
                    >
                      <MessageSquare size={13} /> Give Feedback
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {viewCert && (
        <CertificateModal
          enrollment={viewCert}
          userName={`${viewCert.user?.firstName} ${viewCert.user?.lastName}`}
          onClose={() => setViewCert(null)}
        />
      )}
    </div>
  );
}

// ── CATEGORIES TAB ────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [current, setCurrent] = useState<Partial<TrainingCategory>>({});
  const [saving, setSaving] = useState(false);
  const { user } = useAuthStore();
  const { can } = usePermission();
  const isAdmin = can('TRAINING_MANAGE');

  const load = async () => {
    try {
      setLoading(true);
      setCategories(await trainingApi.getCategories());
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setCurrent({}); setModal(true); };
  const openEdit = (c: TrainingCategory) => { setCurrent(c); setModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name) return;
    try {
      setSaving(true);
      if (current.id) {
        await trainingApi.updateCategory(current.id, { name: current.name, description: current.description ?? undefined });
      } else {
        await trainingApi.createCategory({ name: current.name, description: current.description ?? undefined });
      }
      setModal(false);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await trainingApi.deleteCategory(id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={16} /> New Category
          </button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-5 py-3 font-medium text-muted-foreground">Category</th>
              <th className="px-5 py-3 font-medium text-muted-foreground">Description</th>
              <th className="px-5 py-3 font-medium text-muted-foreground">Programs</th>
              {isAdmin && <th className="px-5 py-3 font-medium text-muted-foreground w-24">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-muted/20 transition-colors group">
                <td className="px-5 py-3 font-semibold">{c.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{c.description ?? '—'}</td>
                <td className="px-5 py-3 text-muted-foreground">{c._count?.programs ?? 0}</td>
                {isAdmin && (
                  <td className="px-5 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No categories yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{current.id ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input required className={inputCls()} placeholder="e.g. Technical Skills" value={current.name ?? ''} onChange={(e) => setCurrent({ ...current, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" value={current.description ?? ''} onChange={(e) => setCurrent({ ...current, description: e.target.value })} />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

type Tab = 'programs' | 'sessions' | 'my' | 'categories';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'programs', label: 'Programs', icon: <BookOpen size={16} /> },
  { id: 'sessions', label: 'Sessions', icon: <CalendarDays size={16} /> },
  { id: 'my', label: 'My Training', icon: <GraduationCap size={16} /> },
  { id: 'categories', label: 'Categories', icon: <Filter size={16} /> },
];

export default function TrainingPage() {
  const { user } = useAuthStore();
  const { can } = usePermission();
  const isAdmin = can('TRAINING_MANAGE');

  const availableTabs = TABS.filter(t => {
    if (t.id === 'categories') return isAdmin;
    return true;
  });

  const [tab, setTab] = useState<Tab>(isAdmin ? 'programs' : 'my');
  const [selectedProgramId, setSelectedProgramId] = useState<string | undefined>();

  const handleBrowseSessions = (programId: string) => {
    setSelectedProgramId(programId);
    setTab('sessions');
  };

  useEffect(() => {
    // If current tab is not available for the role, switch to a safe default
    if (!availableTabs.find(t => t.id === tab)) {
      setTab(isAdmin ? 'programs' : 'my');
    }
  }, [isAdmin, tab, availableTabs]);

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GraduationCap className="text-primary" />
          Training
        </h1>
        <p className="text-muted-foreground mt-1">Manage training programs, schedule sessions, and track employee learning.</p>
      </div>

      {/* tabs */}
      <div className="border-b flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* content */}
      {tab === 'programs' && <ProgramsTab onBrowseSessions={handleBrowseSessions} />}
      {tab === 'sessions' && <SessionsTab initialProgramId={selectedProgramId} />}
      {tab === 'my' && <MyTrainingTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}
