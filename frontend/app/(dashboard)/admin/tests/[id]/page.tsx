'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Users, BookOpen, Clock, Loader2,
  AlertCircle, X, CheckCircle2, UserPlus, BarChart2,
} from 'lucide-react';
import {
  getTest, getQuestionBanks, getQuestions, addTestQuestions,
  assignTest, removeTestAssignment, publishTest,
  Test, Question, QuestionBank, AssignmentTarget,
} from '@/lib/tests-api';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'questions' | 'assign';

function AssignModal({ testId, onClose, onSave }: { testId: string; onClose: () => void; onSave: () => void }) {
  const [target, setTarget] = useState<AssignmentTarget>('USER');
  const [userId, setUserId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/users').then((r) => setUsers(r.data?.data ?? r.data)),
      api.get('/departments').then((r) => setDepartments(r.data?.data ?? r.data)),
      api.get('/roles').then((r) => setRoles(r.data?.data ?? r.data)),
    ]).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await assignTest(testId, {
        target,
        userId: target === 'USER' ? userId : undefined,
        departmentId: target === 'DEPARTMENT' ? departmentId : undefined,
        roleId: target === 'ROLE' ? roleId : undefined,
        dueDate: dueDate || undefined,
      });
      onSave();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to assign test');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-md shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">Assign Test</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="form-label">Assign To</label>
            <div className="flex gap-1.5">
              {(['USER', 'DEPARTMENT', 'ROLE'] as AssignmentTarget[]).map((t) => (
                <button key={t} type="button" onClick={() => setTarget(t)}
                  className={cn('flex-1 py-1.5 rounded border text-xs font-medium transition-colors', target === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {target === 'USER' && (
            <div>
              <label className="form-label">User</label>
              <select required className="field-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Select user...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
              </select>
            </div>
          )}
          {target === 'DEPARTMENT' && (
            <div>
              <label className="form-label">Department</label>
              <select required className="field-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Select department...</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {target === 'ROLE' && (
            <div>
              <label className="form-label">Role</label>
              <select required className="field-select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Select role...</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="form-label">Due Date (optional)</label>
            <input type="datetime-local" className="field-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus size={12} />}
              Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddQuestionsPanel({ testId, onSave }: { testId: string; onSave: () => void }) {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getQuestionBanks().then(setBanks).catch(() => {}); }, []);

  const loadQuestions = async (bankId: string) => {
    setSelectedBank(bankId); setLoading(true);
    try { setQuestions(await getQuestions(bankId)); } finally { setLoading(false); }
  };

  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const items = Array.from(selected).map((questionId, i) => ({ questionId, order: i + 1 }));
      await addTestQuestions(testId, items);
      onSave();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to add questions');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="form-label">Select Question Bank</label>
        <select className="field-select" value={selectedBank} onChange={(e) => loadQuestions(e.target.value)}>
          <option value="">Choose a bank...</option>
          {banks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b._count?.questions} questions)</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center gap-2 p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}

      {!loading && questions.length > 0 && (
        <>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {questions.map((q) => (
              <div key={q.id} onClick={() => toggle(q.id)}
                className={cn('flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors text-xs', selected.has(q.id) ? 'bg-primary/5 border-primary/40' : 'border-border hover:bg-muted/40')}>
                <div className={cn('w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors', selected.has(q.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-border')}>
                  {selected.has(q.id) && <CheckCircle2 size={10} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground line-clamp-1">{q.text}</p>
                  <p className="text-muted-foreground">{q.type.replace('_', ' ')} · {q.difficulty} · {q.marks}m</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <button onClick={handleAdd} disabled={selected.size === 0 || saving} className="btn-primary">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus size={12} />}
              Add Selected
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('questions');
  const [showAddQs, setShowAddQs] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTest(await getTest(id)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handlePublish = async () => {
    setPublishing(true);
    try { await publishTest(id); load(); } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to publish');
    } finally { setPublishing(false); }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Remove this assignment?')) return;
    try { await removeTestAssignment(id, assignmentId); load(); } catch { alert('Failed'); }
  };

  if (loading) return (
    <div className="py-16 text-center flex flex-col items-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
    </div>
  );

  if (!test) return null;

  const isDraft = test.status === 'DRAFT';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/admin/tests" className="p-1.5 hover:bg-muted rounded transition text-muted-foreground mt-0.5">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-base font-semibold text-foreground">{test.title}</h1>
              <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-medium',
                test.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' :
                test.status === 'DRAFT' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
              )}>{test.status}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock size={11} /> {test.duration}m</span>
              <span className="flex items-center gap-1"><BookOpen size={11} /> {test.questions?.length ?? 0} questions</span>
              <span>{test.totalMarks} marks / Pass: {test.passingMarks}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {test._count && test._count.attempts > 0 && (
            <Link href={`/admin/tests/${id}/results`} className="btn-secondary">
              <BarChart2 size={12} /> Results ({test._count.attempts})
            </Link>
          )}
          {isDraft && (
            <>
              <button onClick={() => setShowAddQs((p) => !p)} className="btn-secondary">
                <Plus size={12} /> Add Questions
              </button>
              <button onClick={() => setShowAssign(true)} className="btn-secondary">
                <UserPlus size={12} /> Assign
              </button>
              <button onClick={handlePublish} disabled={publishing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition disabled:opacity-50">
                {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 size={12} />}
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      {showAddQs && isDraft && (
        <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-foreground">Add Questions from Bank</h3>
            <button onClick={() => setShowAddQs(false)} className="p-1 hover:bg-muted rounded transition text-muted-foreground"><X size={13} /></button>
          </div>
          <AddQuestionsPanel testId={id} onSave={() => { setShowAddQs(false); load(); }} />
        </div>
      )}

      {test.instructions && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">Instructions</p>
          <p className="text-xs text-blue-800">{test.instructions}</p>
        </div>
      )}

      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {(['questions', 'assign'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors',
              tab === t ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t === 'questions' ? `Questions (${test.questions?.length ?? 0})` : `Assignments (${test.assignments?.length ?? 0})`}
          </button>
        ))}
      </div>

      {tab === 'questions' && (
        <div className="space-y-2">
          {(test.questions ?? []).length === 0 && (
            <div className="py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No questions added yet. Click "Add Questions" to pick from a question bank.
            </div>
          )}
          {(test.questions ?? []).map((tq, idx) => {
            const q = tq.question;
            return (
              <div key={tq.id} className="bg-card border rounded-lg p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground w-5 shrink-0 pt-0.5">{idx + 1}.</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground mb-1">{q.text}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{q.type.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>{q.difficulty}</span>
                      <span>·</span>
                      <span className="text-primary">{tq.marks ?? q.marks} marks</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'assign' && (
        <div className="space-y-2">
          {isDraft && (
            <button onClick={() => setShowAssign(true)} className="btn-primary">
              <UserPlus size={12} /> Assign Test
            </button>
          )}
          {(test.assignments ?? []).length === 0 && (
            <div className="py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No assignments yet.
            </div>
          )}
          {(test.assignments ?? []).map((a) => (
            <div key={a.id} className="bg-card border rounded-lg p-3 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Users size={13} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{a.target}</p>
                  <p className="text-xs font-medium text-foreground">
                    {a.target === 'USER' && a.user ? `${a.user.firstName} ${a.user.lastName}` : ''}
                    {a.target === 'DEPARTMENT' && a.department ? a.department.name : ''}
                    {a.target === 'ROLE' && a.role ? a.role.name : ''}
                  </p>
                </div>
                {a.dueDate && (
                  <span className="text-xs text-muted-foreground ml-2">Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                )}
              </div>
              {isDraft && (
                <button onClick={() => handleRemoveAssignment(a.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-red-500 rounded transition">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAssign && (
        <AssignModal testId={id} onClose={() => setShowAssign(false)} onSave={() => { setShowAssign(false); load(); }} />
      )}
    </div>
  );
}
