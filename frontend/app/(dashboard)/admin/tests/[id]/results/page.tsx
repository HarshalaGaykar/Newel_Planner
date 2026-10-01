'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Users, BarChart2,
} from 'lucide-react';
import { getTestResults, getTest, TestAttempt, Test } from '@/lib/tests-api';
import { cn } from '@/lib/utils';

export default function TestResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<Test | null>(null);
  const [results, setResults] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([getTest(id), getTestResults(id)]);
      setTest(t); setResults(r);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submitted = results.filter((r) => r.status === 'SUBMITTED');
  const passed = submitted.filter((r) => r.passed);
  const avgScore = submitted.length
    ? (submitted.reduce((s, r) => s + (r.percentage ?? 0), 0) / submitted.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/admin/tests/${id}`} className="p-1.5 hover:bg-muted rounded transition text-muted-foreground">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <BarChart2 size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Results — {test?.title ?? '...'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Attempt overview & scores.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Attempts', value: results.length, icon: Users, bg: 'bg-muted text-foreground' },
          { label: 'Submitted', value: submitted.length, icon: CheckCircle2, bg: 'bg-blue-50 text-blue-600' },
          { label: 'Passed', value: passed.length, icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600' },
          { label: 'Avg Score', value: `${avgScore}%`, icon: BarChart2, bg: 'bg-purple-50 text-purple-600' },
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

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg m-4">
            No attempts yet.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Candidate', 'Status', 'Score', 'Percentage', 'Result', 'Submitted'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const user = (r as any).user;
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/20 transition">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-medium',
                        r.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700' :
                        r.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      )}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {r.score !== null ? r.score : '—'}{r.score !== null ? ` / ${test?.totalMarks}` : ''}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {r.percentage !== null ? `${r.percentage?.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === 'SUBMITTED' ? (
                        r.passed ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle2 size={12} /> Pass
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                            <XCircle size={12} /> Fail
                          </span>
                        )
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
