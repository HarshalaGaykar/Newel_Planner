'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2, XCircle, Loader2, ArrowLeft, Trophy, Target,
} from 'lucide-react';
import { getAttemptResult, getMyTests, TestAttempt, QuestionOption } from '@/lib/tests-api';

function TestResultContent() {
  const { id: testId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let attemptId = searchParams.get('attemptId');
      if (!attemptId) {
        const myTests = await getMyTests();
        const t = myTests.find((t) => t.id === testId);
        if (!t?.attempt) { setError('No completed attempt found.'); setLoading(false); return; }
        attemptId = (t.attempt as any).id;
      }
      setAttempt(await getAttemptResult(attemptId!));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load result');
    } finally {
      setLoading(false);
    }
  }, [testId, searchParams]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-muted-foreground/40" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-card border border-red-200 rounded-lg p-5 max-w-sm text-center shadow space-y-3">
        <XCircle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-xs text-red-600">{error}</p>
        <Link href="/tests" className="btn-primary inline-flex">Back to Tests</Link>
      </div>
    </div>
  );

  if (!attempt) return null;

  const test = attempt.test;
  const passed = attempt.passed;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tests" className="p-1.5 hover:bg-muted rounded-md transition text-muted-foreground">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-foreground">Assessment Result</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{test?.title}</p>
        </div>
      </div>

      {/* Score Card */}
      <div className={`rounded-lg p-5 text-center border ${
        passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
          passed ? 'bg-emerald-100' : 'bg-red-100'
        }`}>
          {passed
            ? <Trophy className="w-7 h-7 text-emerald-600" />
            : <XCircle className="w-7 h-7 text-red-500" />
          }
        </div>
        <h2 className={`text-2xl font-bold mb-0.5 ${passed ? 'text-emerald-700' : 'text-red-600'}`}>
          {attempt.percentage?.toFixed(1)}%
        </h2>
        <p className={`text-sm font-semibold ${passed ? 'text-emerald-600' : 'text-red-500'}`}>
          {passed ? 'Passed' : 'Failed'}
        </p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Target size={12} /> Score: <strong className="text-foreground ml-0.5">{attempt.score}/{test?.totalMarks}</strong>
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} /> Pass at: {test?.passingMarks}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Correct', value: attempt.answers?.filter((a) => a.isCorrect).length ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Wrong', value: attempt.answers?.filter((a) => a.isCorrect === false).length ?? 0, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Unattempted', value: (test?.questions?.length ?? 0) - (attempt.answers?.length ?? 0), color: 'text-muted-foreground', bg: 'bg-muted' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-lg p-3 text-center`}>
            <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Answers Breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Question Review</h3>
        {(attempt.answers ?? []).map((ans, idx) => {
          const q = ans.question;
          if (!q) return null;
          const options = (q.options ?? []) as QuestionOption[];
          const correctIds = (q.correctOptions ?? []) as string[];
          const selectedIds = ans.selectedOptions ?? [];

          return (
            <div
              key={ans.id}
              className={`bg-card rounded-lg border p-4 shadow-sm ${ans.isCorrect ? 'border-emerald-200' : 'border-red-200'}`}
            >
              <div className="flex items-start gap-2 mb-3">
                {ans.isCorrect
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                }
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground">Q{idx + 1}</span>
                    <span className={`text-xs font-medium ${ans.isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
                      {ans.marksObtained}/{q.marks} marks
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{q.text}</p>
                </div>
              </div>

              <div className="space-y-1.5 ml-6">
                {options.map((opt) => {
                  const isCorrect = correctIds.includes(opt.id);
                  const isSelected = selectedIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition ${
                        isCorrect
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium'
                          : isSelected && !isCorrect
                          ? 'bg-red-50 border-red-200 text-red-600 font-medium'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {isCorrect
                        ? <CheckCircle2 size={12} className="flex-shrink-0" />
                        : isSelected
                        ? <XCircle size={12} className="flex-shrink-0" />
                        : <div className="w-3 h-3 flex-shrink-0" />
                      }
                      {opt.text}
                      {isSelected && !isCorrect && (
                        <span className="ml-auto text-xs text-muted-foreground">Your answer</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <div className="mt-3 ml-6 p-2.5 bg-blue-50 border border-blue-100 rounded">
                  <p className="text-xs font-medium text-blue-700 mb-0.5">Explanation</p>
                  <p className="text-xs text-blue-800">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center pt-2 pb-4">
        <Link href="/tests" className="btn-primary inline-flex">
          <ArrowLeft size={13} /> Back to Assessments
        </Link>
      </div>
    </div>
  );
}

export default function TestResultPage() {
  return (
    <Suspense fallback={null}>
      <TestResultContent />
    </Suspense>
  );
}
