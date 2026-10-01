'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList, Plus, Search, Loader2, Trash2, Eye,
  BookOpen, Users, CheckCircle2, Clock, BarChart2,
} from 'lucide-react';
import {
  getTests, deleteTest, publishTest, closeTest,
  Test, TestStatus,
} from '@/lib/tests-api';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<TestStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-500',
};

export default function AdminTestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TestStatus | 'ALL'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try { setTests(await getTests()); } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test permanently?')) return;
    try { await deleteTest(id); load(); } catch { alert('Failed to delete test'); }
  };

  const handlePublish = async (id: string) => {
    try { await publishTest(id); load(); } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to publish');
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm('Close this test? No new attempts will be allowed.')) return;
    try { await closeTest(id); load(); } catch { alert('Failed to close test'); }
  };

  const visible = tests.filter((t) => {
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = {
    total: tests.length,
    published: tests.filter((t) => t.status === 'PUBLISHED').length,
    draft: tests.filter((t) => t.status === 'DRAFT').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Test Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Objective assessments & knowledge evaluation.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/tests/question-banks" className="btn-secondary">
            <BookOpen size={13} /> Question Banks
          </Link>
          <Link href="/admin/tests/new" className="btn-primary">
            <Plus size={13} /> New Test
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Total Tests', value: counts.total, icon: ClipboardList, bg: 'bg-muted text-foreground' },
          { label: 'Published', value: counts.published, icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600' },
          { label: 'Drafts', value: counts.draft, icon: Clock, bg: 'bg-amber-50 text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="bg-card border rounded-lg p-3 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-semibold text-foreground mt-0.5">{s.value}</p>
            </div>
            <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', s.bg)}>
              <s.icon size={14} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 max-w-sm w-full">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search tests..." className="field-input pl-8"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(['ALL', 'DRAFT', 'PUBLISHED', 'CLOSED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg m-4">
            No tests found.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Test', 'Duration', 'Marks', 'Questions', 'Attempts', 'Status', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((test) => (
                <tr key={test.id} className="border-b hover:bg-muted/20 transition group">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{test.title}</p>
                    {test.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{test.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock size={11} /> {test.duration}m
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{test.totalMarks}</span>
                    <span className="text-muted-foreground"> / {test.passingMarks}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <BookOpen size={11} /> {test._count?.questions ?? 0}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Users size={11} /> {test._count?.attempts ?? 0}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[test.status])}>
                      {test.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <Link href={`/admin/tests/${test.id}`} className="p-1 hover:bg-blue-50 text-blue-600 rounded transition">
                        <Eye size={12} />
                      </Link>
                      {test._count?.attempts !== undefined && test._count.attempts > 0 && (
                        <Link href={`/admin/tests/${test.id}/results`} className="p-1 hover:bg-emerald-50 text-emerald-600 rounded transition">
                          <BarChart2 size={12} />
                        </Link>
                      )}
                      {test.status === 'DRAFT' && (
                        <button onClick={() => handlePublish(test.id)} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-100 transition">
                          Publish
                        </button>
                      )}
                      {test.status === 'PUBLISHED' && (
                        <button onClick={() => handleClose(test.id)} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 transition">
                          Close
                        </button>
                      )}
                      {test.status === 'DRAFT' && (
                        <button onClick={() => handleDelete(test.id)} className="p-1 hover:bg-red-50 text-red-600 rounded transition">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
