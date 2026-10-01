'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, Plus, Edit2, Trash2, AlertCircle, Search, Filter,
  ChevronDown, ChevronRight, X, Loader2, CheckCircle2, XCircle,
  AlertTriangle, MinusCircle, SkipForward, Play, FolderOpen,
  ClipboardList, BarChart2, Calendar, User, Tag,
} from 'lucide-react';
import Link from 'next/link';
import {
  testManagementApi, TestSuite, TestCase, TestRun,
  TestCasePriority, TestCaseStatus, TestRunStatus, TestCaseStep,
  TestCaseType, TestCaseCategory, ExecutionResult,
} from '@/lib/test-management-api';
import { projectsApi, Project } from '@/lib/projects-api';
import { sprintsApi, Sprint } from '@/lib/sprints-api';
import { usersApi, User as AppUser } from '@/lib/users-api';
import { usePermission } from '@/lib/hooks/usePermission';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inputCls() {
  return 'w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
}

function userName(u?: { firstName: string | null; lastName: string | null } | null) {
  if (!u) return '—';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
}

// ── constants ─────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<TestCasePriority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const CASE_STATUS_COLOR: Record<TestCaseStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-700',
  DEPRECATED: 'bg-red-100 text-red-500',
};

const RUN_STATUS_COLOR: Record<TestRunStatus, string> = {
  PLANNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ABORTED: 'bg-red-100 text-red-600',
};

const TYPE_COLOR: Record<TestCaseType, string> = {
  MANUAL: 'bg-indigo-100 text-indigo-700',
  AUTOMATED: 'bg-purple-100 text-purple-700',
};

const CATEGORY_COLOR: Record<TestCaseCategory, string> = {
  FUNCTIONAL: 'bg-sky-100 text-sky-700',
  UI: 'bg-pink-100 text-pink-700',
  API: 'bg-emerald-100 text-emerald-700',
  SECURITY: 'bg-slate-800 text-slate-100',
  PERFORMANCE: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

const RESULT_COLOR: Record<ExecutionResult, string> = {
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  BLOCKED: 'bg-amber-100 text-amber-700',
  SKIPPED: 'bg-gray-100 text-gray-600',
  NOT_RUN: 'bg-slate-100 text-slate-600',
};

const ENV_COLOR: Record<string, string> = {
  DEV: 'bg-slate-100 text-slate-700',
  STAGING: 'bg-amber-100 text-amber-700 border-amber-200',
  UAT: 'bg-purple-100 text-purple-700',
  PRODUCTION: 'bg-red-100 text-red-700 font-bold',
  OTHER: 'bg-gray-100 text-gray-600',
};

// ── SUITES TAB ────────────────────────────────────────────────────────────────

function SuitesTab() {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<TestSuite>>({});
  const [saving, setSaving] = useState(false);
  const { can } = usePermission();
  const canManage = can('TEST_MANAGE');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [s, p] = await Promise.all([
        testManagementApi.getSuites({ projectId: filterProject || undefined, search: search || undefined }),
        projectsApi.getAll(),
      ]);
      setSuites(s);
      setProjects(p);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load suites');
    } finally {
      setLoading(false);
    }
  }, [filterProject, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCurrent({ projectId: filterProject || '' });
    setModal('create');
  };

  const openEdit = (s: TestSuite) => {
    setCurrent({ ...s });
    setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'create') {
        await testManagementApi.createSuite({
          name: current.name!,
          description: current.description || undefined,
          projectId: current.projectId!,
        });
      } else {
        await testManagementApi.updateSuite(current.id!, {
          name: current.name,
          description: current.description || undefined,
        });
      }
      setModal(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save suite');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this suite and all its test cases?')) return;
    try {
      await testManagementApi.deleteSuite(id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete suite');
    }
  };

  const toggleExpand = async (suite: TestSuite) => {
    const next = new Set(expanded);
    if (next.has(suite.id)) {
      next.delete(suite.id);
    } else {
      next.add(suite.id);
      // load full suite with cases if not loaded
      if (!suite.cases) {
        try {
          const full = await testManagementApi.getSuite(suite.id);
          setSuites((prev) => prev.map((s) => (s.id === suite.id ? full : s)));
        } catch { /* ignore */ }
      }
    }
    setExpanded(next);
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  return (
    <div>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search suites…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Suite
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : suites.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No test suites found</p>
          {canManage && <p className="text-sm mt-1">Create your first suite to start organising test cases.</p>}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-8"></th>
                <th className="text-left px-4 py-3 font-medium">Suite</th>
                <th className="text-left px-4 py-3 font-medium">Project</th>
                <th className="text-left px-4 py-3 font-medium">Cases</th>
                <th className="text-left px-4 py-3 font-medium">Created By</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                {canManage && <th className="px-4 py-3 w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {suites.map((suite) => (
                <React.Fragment key={suite.id}>
                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleExpand(suite)} className="text-muted-foreground hover:text-foreground">
                        {expanded.has(suite.id)
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExpand(suite)}
                        className="font-medium text-left hover:text-primary"
                      >
                        {suite.name}
                      </button>
                      {suite.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{suite.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{projectName(suite.projectId)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {suite._count?.cases ?? suite.cases?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{userName(suite.createdBy)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(suite.createdAt)}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(suite)} className="text-muted-foreground hover:text-foreground">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(suite.id)} className="text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {expanded.has(suite.id) && (
                    <tr className="border-b border-border bg-muted/10">
                      <td colSpan={canManage ? 7 : 6} className="px-8 py-3">
                        {!suite.cases ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading cases…
                          </div>
                        ) : suite.cases.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">No test cases in this suite yet.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left py-1.5 pr-4 font-medium">Title</th>
                                <th className="text-left py-1.5 pr-4 font-medium">Priority</th>
                                <th className="text-left py-1.5 pr-4 font-medium">Status</th>
                                <th className="text-left py-1.5 font-medium">Assigned To</th>
                              </tr>
                            </thead>
                            <tbody>
                              {suite.cases.map((c) => (
                                <tr key={c.id} className="border-t border-border/50">
                                  <td className="py-2 pr-4">{c.title}</td>
                                  <td className="py-2 pr-4">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[c.priority]}`}>
                                      {c.priority}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-4">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CASE_STATUS_COLOR[c.status]}`}>
                                      {c.status}
                                    </span>
                                  </td>
                                  <td className="py-2 text-muted-foreground">{userName(c.assignedTo)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suite modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{modal === 'create' ? 'New Test Suite' : 'Edit Suite'}</h2>
              <button onClick={() => setModal(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Suite Name *</label>
                <input
                  required
                  className={inputCls()}
                  value={current.name || ''}
                  onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                  placeholder="e.g. Authentication Module"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={current.description || ''}
                  onChange={(e) => setCurrent({ ...current, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              {modal === 'create' && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Project *</label>
                  <select
                    required
                    className={inputCls()}
                    value={current.projectId || ''}
                    onChange={(e) => setCurrent({ ...current, projectId: e.target.value })}
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {modal === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CASES TAB ─────────────────────────────────────────────────────────────────

function CasesTab() {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterSuite, setFilterSuite] = useState('');
  const [filterPriority, setFilterPriority] = useState<TestCasePriority | ''>('');
  const [filterStatus, setFilterStatus] = useState<TestCaseStatus | ''>('');
  const [filterType, setFilterType] = useState<TestCaseType | ''>('');
  const [filterCategory, setFilterCategory] = useState<TestCaseCategory | ''>('');

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<TestCase> & { steps?: TestCaseStep[] }>({});
  const [saving, setSaving] = useState(false);
  const { can } = usePermission();
  const canManage = can('TEST_MANAGE');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [c, s, u] = await Promise.all([
        testManagementApi.getCases({
          suiteId: filterSuite || undefined,
          priority: filterPriority || undefined,
          status: filterStatus || undefined,
          type: filterType || undefined,
          category: filterCategory || undefined,
          search: search || undefined,
        }),
        testManagementApi.getSuites(),
        usersApi.getUsers(),
      ]);
      setCases(c);
      setSuites(s);
      setUsers(u);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [filterSuite, filterPriority, filterStatus, filterType, filterCategory, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCurrent({ priority: 'MEDIUM', status: 'DRAFT', type: 'MANUAL', category: 'FUNCTIONAL', tags: [], steps: [] });
    setModal('create');
  };

  const openEdit = (c: TestCase) => {
    setCurrent({ ...c, steps: c.steps || [] });
    setModal('edit');
  };

  const addStep = () => {
    const steps = [...(current.steps || [])];
    steps.push({ order: steps.length + 1, action: '', expected: '' });
    setCurrent({ ...current, steps });
  };

  const updateStep = (idx: number, field: 'action' | 'expected', value: string) => {
    const steps = [...(current.steps || [])];
    steps[idx] = { ...steps[idx], [field]: value };
    setCurrent({ ...current, steps });
  };

  const removeStep = (idx: number) => {
    const steps = (current.steps || []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    setCurrent({ ...current, steps });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: current.title!,
        description: current.description || undefined,
        preconditions: current.preconditions || undefined,
        steps: current.steps,
        expectedResult: current.expectedResult || undefined,
        priority: current.priority,
        status: current.status,
        type: current.type,
        category: current.category,
        tags: current.tags,
        automationId: current.automationId || undefined,
        requirementId: current.requirementId || undefined,
        suiteId: current.suiteId!,
        assignedToId: current.assignedToId || undefined,
      };
      if (modal === 'create') {
        await testManagementApi.createCase(payload as any);
      } else {
        await testManagementApi.updateCase(current.id!, payload);
      }
      setModal(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save case');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test case?')) return;
    try {
      await testManagementApi.deleteCase(id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete case');
    }
  };

  return (
    <div>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search cases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterSuite} onChange={(e) => setFilterSuite(e.target.value)}>
          <option value="">All Suites</option>
          {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as any)}>
          <option value="">All Priorities</option>
          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TestCasePriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
          <option value="">All Statuses</option>
          {(['DRAFT', 'ACTIVE', 'DEPRECATED'] as TestCaseStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
          <option value="">All Types</option>
          {(['MANUAL', 'AUTOMATED'] as TestCaseType[]).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)}>
          <option value="">All Categories</option>
          {(['FUNCTIONAL', 'UI', 'API', 'SECURITY', 'PERFORMANCE', 'OTHER'] as TestCaseCategory[]).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Case
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No test cases found</p>
          {canManage && <p className="text-sm mt-1">Create test cases within your suites.</p>}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Suite</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Last Result</th>
                <th className="text-left px-4 py-3 font-medium">Assigned To</th>
                {canManage && <th className="px-4 py-3 w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${CATEGORY_COLOR[c.category]}`}>
                        {c.category}
                      </span>
                      {c.tags?.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.suite?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[c.type]}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[c.priority]}`}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CASE_STATUS_COLOR[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.lastResult ? (
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLOR[c.lastResult]}`}>
                          {c.lastResult}
                        </span>
                        {c.lastExecutedAt && (
                          <p className="text-[10px] text-muted-foreground mt-1">{fmt(c.lastExecutedAt)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Never Run</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{userName(c.assignedTo)}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(c)} className="text-muted-foreground hover:text-foreground">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Case modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">{modal === 'create' ? 'New Test Case' : 'Edit Test Case'}</h2>
              <button onClick={() => setModal(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title *</label>
                <input
                  required
                  className={inputCls()}
                  value={current.title || ''}
                  onChange={(e) => setCurrent({ ...current, title: e.target.value })}
                  placeholder="e.g. Verify login with valid credentials"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Suite *</label>
                  <select
                    required
                    className={inputCls()}
                    value={current.suiteId || ''}
                    onChange={(e) => setCurrent({ ...current, suiteId: e.target.value })}
                  >
                    <option value="">Select suite</option>
                    {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Assigned To</label>
                  <select
                    className={inputCls()}
                    value={current.assignedToId || ''}
                    onChange={(e) => setCurrent({ ...current, assignedToId: e.target.value || undefined })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{[u.firstName, u.lastName].filter(Boolean).join(' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Priority</label>
                  <select
                    className={inputCls()}
                    value={current.priority || 'MEDIUM'}
                    onChange={(e) => setCurrent({ ...current, priority: e.target.value as TestCasePriority })}
                  >
                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TestCasePriority[]).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <select
                    className={inputCls()}
                    value={current.status || 'DRAFT'}
                    onChange={(e) => setCurrent({ ...current, status: e.target.value as TestCaseStatus })}
                  >
                    {(['DRAFT', 'ACTIVE', 'DEPRECATED'] as TestCaseStatus[]).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <select
                    className={inputCls()}
                    value={current.type || 'MANUAL'}
                    onChange={(e) => setCurrent({ ...current, type: e.target.value as TestCaseType })}
                  >
                    {(['MANUAL', 'AUTOMATED'] as TestCaseType[]).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <select
                    className={inputCls()}
                    value={current.category || 'FUNCTIONAL'}
                    onChange={(e) => setCurrent({ ...current, category: e.target.value as TestCaseCategory })}
                  >
                    {(['FUNCTIONAL', 'UI', 'API', 'SECURITY', 'PERFORMANCE', 'OTHER'] as TestCaseCategory[]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Automation ID / Script Path</label>
                  <input
                    className={inputCls()}
                    value={current.automationId || ''}
                    onChange={(e) => setCurrent({ ...current, automationId: e.target.value })}
                    placeholder="e.g. auth-001"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Requirement ID / Link</label>
                  <input
                    className={inputCls()}
                    value={current.requirementId || ''}
                    onChange={(e) => setCurrent({ ...current, requirementId: e.target.value })}
                    placeholder="e.g. REQ-123"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tags (comma separated)</label>
                <input
                  className={inputCls()}
                  value={current.tags?.join(', ') || ''}
                  onChange={(e) => setCurrent({ ...current, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="e.g. smoke, regression"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={current.description || ''}
                  onChange={(e) => setCurrent({ ...current, description: e.target.value })}
                  placeholder="Brief description of what this test covers"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Preconditions</label>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={current.preconditions || ''}
                  onChange={(e) => setCurrent({ ...current, preconditions: e.target.value })}
                  placeholder="System state required before executing this test"
                />
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Test Steps</label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add Step
                  </button>
                </div>
                {(current.steps || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No steps added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(current.steps || []).map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-muted/30 rounded-md">
                        <span className="text-xs font-medium text-muted-foreground mt-2 w-5 shrink-0">{idx + 1}.</span>
                        <div className="flex-1 space-y-1.5">
                          <input
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Action — what to do"
                            value={step.action}
                            onChange={(e) => updateStep(idx, 'action', e.target.value)}
                          />
                          <input
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Expected result"
                            value={step.expected}
                            onChange={(e) => updateStep(idx, 'expected', e.target.value)}
                          />
                        </div>
                        <button type="button" onClick={() => removeStep(idx)} className="mt-1 text-muted-foreground hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Expected Result (overall)</label>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={current.expectedResult || ''}
                  onChange={(e) => setCurrent({ ...current, expectedResult: e.target.value })}
                  placeholder="What should happen when this test passes"
                />
              </div>
            </form>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button
                form="case-form"
                onClick={(e) => { e.preventDefault(); handleSave(e as any); }}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {modal === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RUNS TAB ──────────────────────────────────────────────────────────────────

function RunsTab() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState<TestRunStatus | ''>('');

  const [modal, setModal] = useState<'create' | null>(null);
  const [current, setCurrent] = useState<{
    name: string; description: string; projectId: string;
    sprintId: string; environment: string; plannedAt: string; suiteId: string; caseIds: string[];
  }>({ name: '', description: '', projectId: '', sprintId: '', environment: 'STAGING', plannedAt: '', suiteId: '', caseIds: [] });
  const [saving, setSaving] = useState(false);
  const { can } = usePermission();
  const canManage = can('TEST_MANAGE');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [r, p] = await Promise.all([
        testManagementApi.getRuns({ projectId: filterProject || undefined, status: filterStatus || undefined }),
        projectsApi.getAll(),
      ]);
      setRuns(r);
      setProjects(p);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, [filterProject, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const onProjectChange = async (projectId: string) => {
    setCurrent((c) => ({ ...c, projectId, sprintId: '', suiteId: '', caseIds: [] }));
    if (projectId) {
      const [sp, su] = await Promise.all([sprintsApi.list(projectId), testManagementApi.getSuites({ projectId })]);
      setSprints(sp);
      setSuites(su);
    } else {
      setSprints([]);
      setSuites([]);
      setCases([]);
    }
  };

  const onSuiteChange = async (suiteId: string) => {
    setCurrent((c) => ({ ...c, suiteId, caseIds: [] }));
    if (suiteId) {
      const suite = await testManagementApi.getSuite(suiteId);
      setCases(suite.cases || []);
    } else {
      setCases([]);
    }
  };

  const toggleCase = (id: string) => {
    setCurrent((c) => ({
      ...c,
      caseIds: c.caseIds.includes(id) ? c.caseIds.filter((x) => x !== id) : [...c.caseIds, id],
    }));
  };

  const openCreate = () => {
    setCurrent({ name: '', description: '', projectId: '', sprintId: '', environment: 'STAGING', plannedAt: '', suiteId: '', caseIds: [] });
    setSprints([]);
    setSuites([]);
    setCases([]);
    setModal('create');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await testManagementApi.createRun({
        name: current.name,
        description: current.description || undefined,
        projectId: current.projectId,
        sprintId: current.sprintId || undefined,
        environment: current.environment as any,
        plannedAt: current.plannedAt || undefined,
        caseIds: current.caseIds.length ? current.caseIds : undefined,
      });
      setModal(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create run');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test run?')) return;
    try {
      await testManagementApi.deleteRun(id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete run');
    }
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  return (
    <div>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
          <option value="">All Statuses</option>
          {(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED'] as TestRunStatus[]).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        {canManage && (
          <button
            onClick={openCreate}
            className="ml-auto flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Run
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Play className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No test runs found</p>
          {canManage && <p className="text-sm mt-1">Create a test run to start executing test cases.</p>}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Run</th>
                <th className="text-left px-4 py-3 font-medium">Project</th>
                <th className="text-left px-4 py-3 font-medium">Sprint</th>
                <th className="text-left px-4 py-3 font-medium">Env</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Cases</th>
                <th className="text-left px-4 py-3 font-medium">Planned</th>
                <th className="text-left px-4 py-3 font-medium">Created By</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/test-management/runs/${run.id}`} className="font-medium hover:text-primary hover:underline">
                      {run.name}
                    </Link>
                    {run.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{run.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{projectName(run.projectId)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{run.sprint?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ENV_COLOR[run.environment]}`}>
                      {run.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RUN_STATUS_COLOR[run.status]}`}>
                      {run.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{run._count?.executions ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{run.plannedAt ? fmt(run.plannedAt) : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{userName(run.createdBy)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/test-management/runs/${run.id}`}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                      >
                        <Play className="h-3 w-3" /> Execute
                      </Link>
                      {canManage && (
                        <button onClick={() => handleDelete(run.id)} className="text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Run modal */}
      {modal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">New Test Run</h2>
              <button onClick={() => setModal(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Run Name *</label>
                <input
                  required
                  className={inputCls()}
                  value={current.name}
                  onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                  placeholder="e.g. Sprint 5 Regression"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Project *</label>
                <select
                  required
                  className={inputCls()}
                  value={current.projectId}
                  onChange={(e) => onProjectChange(e.target.value)}
                >
                  <option value="">Select project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Sprint</label>
                  <select
                    className={inputCls()}
                    value={current.sprintId}
                    onChange={(e) => setCurrent({ ...current, sprintId: e.target.value })}
                    disabled={!current.projectId}
                  >
                    <option value="">None</option>
                    {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Environment</label>
                  <select
                    className={inputCls()}
                    value={current.environment}
                    onChange={(e) => setCurrent({ ...current, environment: e.target.value })}
                  >
                    {['DEV', 'STAGING', 'UAT', 'PRODUCTION', 'OTHER'].map((env) => (
                      <option key={env} value={env}>{env}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Planned Date</label>
                  <input
                    type="date"
                    className={inputCls()}
                    value={current.plannedAt}
                    onChange={(e) => setCurrent({ ...current, plannedAt: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={current.description}
                  onChange={(e) => setCurrent({ ...current, description: e.target.value })}
                  placeholder="Optional notes about this run"
                />
              </div>

              {/* Add cases from suite */}
              <div>
                <label className="text-sm font-medium mb-1 block">Add Cases from Suite (optional)</label>
                <select
                  className={inputCls()}
                  value={current.suiteId}
                  onChange={(e) => onSuiteChange(e.target.value)}
                  disabled={!current.projectId}
                >
                  <option value="">Select suite to pick cases</option>
                  {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {cases.length > 0 && (
                  <div className="mt-2 border border-border rounded-md max-h-40 overflow-y-auto">
                    <div className="px-3 py-2 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground border-b border-border">
                      <span>{current.caseIds.length} of {cases.length} selected</span>
                      <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={() => setCurrent((c) => ({
                          ...c,
                          caseIds: c.caseIds.length === cases.length ? [] : cases.map((c) => c.id),
                        }))}
                      >
                        {current.caseIds.length === cases.length ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    {cases.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 cursor-pointer text-sm border-b border-border/50 last:border-0">
                        <input
                          type="checkbox"
                          checked={current.caseIds.includes(c.id)}
                          onChange={() => toggleCase(c.id)}
                          className="rounded"
                        />
                        <span className="flex-1">{c.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${PRIORITY_COLOR[c.priority]}`}>{c.priority}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </form>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={(e) => handleSave(e as any)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

type Tab = 'suites' | 'cases' | 'runs';

export default function TestManagementPage() {
  const [tab, setTab] = useState<Tab>('suites');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'suites', label: 'Test Suites', icon: <FolderOpen className="h-4 w-4" /> },
    { id: 'cases', label: 'Test Cases', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'runs', label: 'Test Runs', icon: <Play className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <FlaskConical className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Test Management</h1>
          <p className="text-sm text-muted-foreground">Organise and execute QA test cases</p>
        </div>
      </div>

      {/* tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* content */}
      {tab === 'suites' && <SuitesTab />}
      {tab === 'cases' && <CasesTab />}
      {tab === 'runs' && <RunsTab />}
    </div>
  );
}
