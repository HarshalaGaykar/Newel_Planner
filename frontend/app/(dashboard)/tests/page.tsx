'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardList, Clock, CheckCircle2, XCircle, AlertCircle,
  Loader2, Play, Eye,
} from 'lucide-react';
import { getMyTests, startAttempt, MyTest } from '@/lib/tests-api';

export default function MyTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<MyTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTests(await getMyTests()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async (testId: string) => {
    setStarting(testId);
    try {
      const attempt = await startAttempt(testId);
      router.push(`/tests/${testId}/take?attemptId=${attempt.id}`);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to start test');
    } finally {
      setStarting(null);
    }
  };

  const pending = tests.filter((t) => !t.attempt);
  const inProgress = tests.filter((t) => t.attempt?.status === 'IN_PROGRESS');
  const completed = tests.filter((t) => t.attempt?.status === 'SUBMITTED' || t.attempt?.status === 'EXPIRED');

  const isOverdue = (t: MyTest) => t.dueDate && new Date(t.dueDate) < new Date() && !t.attempt;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-foreground">My Assessments</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Assigned knowledge evaluations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: pending.length, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'In Progress', value: inProgress.length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Completed', value: completed.length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((s, i) => (
          <div key={i} className="bg-card p-3 rounded-lg border border-border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
              <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg ${s.bg} ${s.color} flex items-center justify-center`}>
              <s.icon size={16} />
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Loading assessments...</p>
        </div>
      ) : tests.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
          No assessments assigned to you.
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((test) => {
            const overdue = isOverdue(test);
            const attempt = test.attempt;

            return (
              <div
                key={test.id}
                className={`bg-card border rounded-lg p-3 shadow-sm hover:shadow transition ${
                  overdue ? 'border-red-200' : 'border-border'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-xs font-semibold text-foreground">{test.title}</h3>
                      {overdue && (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle size={11} /> Overdue
                        </span>
                      )}
                    </div>
                    {test.description && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{test.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock size={11} /> {test.duration} min</span>
                      <span>{test.totalMarks} marks</span>
                      <span>Pass: {test.passingMarks}</span>
                      {test.dueDate && (
                        <span className={overdue ? 'text-red-500' : ''}>
                          Due: {new Date(test.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!attempt && (
                      <button
                        onClick={() => handleStart(test.id)}
                        disabled={starting === test.id}
                        className="btn-primary"
                      >
                        {starting === test.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play size={12} />}
                        Start
                      </button>
                    )}

                    {attempt?.status === 'IN_PROGRESS' && (
                      <Link
                        href={`/tests/${test.id}/take?resuming=true`}
                        className="btn btn bg-amber-500 text-white hover:opacity-90 shadow-sm"
                      >
                        <Clock size={12} /> Resume
                      </Link>
                    )}

                    {attempt?.status === 'SUBMITTED' && (
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className={`text-xs font-medium ${attempt.passed ? 'text-emerald-600' : 'text-red-500'} flex items-center gap-1`}>
                            {attempt.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {attempt.passed ? 'Passed' : 'Failed'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {attempt.score}/{test.totalMarks} ({attempt.percentage?.toFixed(1)}%)
                          </div>
                        </div>
                        <Link href={`/tests/${test.id}/result?attemptId=${attempt.id}`} className="btn-secondary">
                          <Eye size={12} /> Review
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
