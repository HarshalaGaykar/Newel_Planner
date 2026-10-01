'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  Clock, ChevronLeft, ChevronRight, Flag, CheckCircle2,
  Loader2, AlertCircle,
} from 'lucide-react';
import {
  startAttempt, getAttempt, saveAnswer, submitAttempt,
  TestAttempt, TestQuestion, Question, QuestionOption,
} from '@/lib/tests-api';

function useTimer(startedAt: string, durationMinutes: number, onExpire: () => void) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    const update = () => {
      const left = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) onExpire();
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isWarning = remaining < 300;

  return { minutes, seconds, isWarning, remaining };
}

function TakeTestContent() {
  const { id: testId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const attemptId = searchParams.get('attemptId');
        let a: TestAttempt;
        if (attemptId) {
          a = await getAttempt(attemptId);
        } else {
          a = await startAttempt(testId);
        }
        setAttempt(a);
        const savedMap: Record<string, string[]> = {};
        (a.answers ?? []).forEach((ans) => { savedMap[ans.questionId] = ans.selectedOptions; });
        setAnswers(savedMap);
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Failed to load test');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [testId, searchParams]);

  const handleAutoSubmit = useCallback(async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    try {
      await submitAttempt(attempt.id);
      router.replace(`/tests/${testId}/result?attemptId=${attempt.id}`);
    } catch {
      router.replace('/tests');
    }
  }, [attempt, submitting, router, testId]);

  const { minutes, seconds, isWarning } = useTimer(
    attempt?.startedAt ?? new Date().toISOString(),
    attempt?.test?.duration ?? 30,
    handleAutoSubmit,
  );

  const questions: TestQuestion[] = attempt?.test?.questions ?? [];
  const currentQ = questions[currentIdx];
  const question: Question | undefined = currentQ?.question as Question | undefined;

  const selectOption = async (optionId: string) => {
    if (!question || !attempt) return;
    const type = question.type;
    let newSelected: string[];

    if (type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE') {
      newSelected = [optionId];
    } else {
      const prev = answers[question.id] ?? [];
      newSelected = prev.includes(optionId) ? prev.filter((o) => o !== optionId) : [...prev, optionId];
    }

    setAnswers((prev) => ({ ...prev, [question.id]: newSelected }));

    if (!savingRef.current) {
      savingRef.current = true;
      try { await saveAnswer(attempt.id, question.id, newSelected); } catch { } finally { savingRef.current = false; }
    }
  };

  const handleSubmit = async () => {
    if (!attempt) return;
    const unanswered = questions.length - Object.keys(answers).length;
    if (unanswered > 0) {
      if (!confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    } else {
      if (!confirm('Submit test? You cannot change answers after submission.')) return;
    }
    setSubmitting(true);
    try {
      await submitAttempt(attempt.id);
      router.replace(`/tests/${testId}/result?attemptId=${attempt.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to submit');
      setSubmitting(false);
    }
  };

  const getQuestionStatus = (qId: string) => {
    if (flagged.has(qId)) return 'flagged';
    if (answers[qId]?.length > 0) return 'answered';
    return 'unanswered';
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Loading assessment...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-card border border-red-200 rounded-lg p-5 max-w-sm text-center shadow space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-xs text-red-600">{error}</p>
        <button onClick={() => router.push('/tests')} className="btn-primary">
          Back to Tests
        </button>
      </div>
    </div>
  );

  if (!attempt || !question) return null;

  const selectedOptions = answers[question.id] ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <div className={`sticky top-0 z-10 border-b bg-card shadow-sm flex items-center justify-between px-4 py-2 ${isWarning ? 'border-red-300' : 'border-border'}`}>
        <div className="flex-1">
          <h1 className="text-xs font-semibold text-foreground line-clamp-1">{attempt.test?.title}</h1>
          <p className="text-xs text-muted-foreground">Question {currentIdx + 1} of {questions.length}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
          isWarning ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-muted text-foreground'
        }`}>
          <Clock size={13} />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigator Sidebar */}
        <div className="hidden md:flex flex-col w-44 border-r border-border bg-card p-3 overflow-y-auto flex-shrink-0">
          <p className="text-xs text-muted-foreground mb-2">Navigator</p>
          <div className="grid grid-cols-5 gap-1">
            {questions.map((tq, idx) => {
              const status = getQuestionStatus(tq.question.id);
              return (
                <button
                  key={tq.id}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-7 h-7 rounded text-xs font-medium transition ${
                    idx === currentIdx ? 'ring-2 ring-primary ring-offset-1' : ''
                  } ${
                    status === 'answered' ? 'bg-emerald-100 text-emerald-700' :
                    status === 'flagged' ? 'bg-amber-100 text-amber-700' :
                    'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-1.5">
            {[
              { color: 'bg-emerald-100 text-emerald-700', label: 'Answered' },
              { color: 'bg-amber-100 text-amber-700', label: 'Flagged' },
              { color: 'bg-muted text-muted-foreground', label: 'Unanswered' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`w-3 h-3 rounded ${s.color}`} />
                {s.label}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full btn-primary justify-center"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 size={12} />}
              Submit
            </button>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Question Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">Q{currentIdx + 1}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    question.difficulty === 'EASY' ? 'bg-emerald-50 text-emerald-600' :
                    question.difficulty === 'MEDIUM' ? 'bg-amber-50 text-amber-600' :
                    'bg-red-50 text-red-600'
                  }`}>{question.difficulty}</span>
                  <span className="text-xs text-muted-foreground">{currentQ.marks ?? question.marks} mark(s)</span>
                </div>
                <p className="text-sm font-medium text-foreground leading-relaxed">{question.text}</p>
              </div>
              <button
                onClick={() => setFlagged((prev) => {
                  const next = new Set(prev);
                  next.has(question.id) ? next.delete(question.id) : next.add(question.id);
                  return next;
                })}
                className={`p-1.5 rounded transition flex-shrink-0 ${
                  flagged.has(question.id) ? 'bg-amber-50 text-amber-600' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <Flag size={14} />
              </button>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {(question.options as QuestionOption[]).map((opt) => {
                const selected = selectedOptions.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => selectOption(opt.id)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition text-xs font-medium ${
                      selected
                        ? 'bg-primary/5 border-primary text-foreground shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                      selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                    }`}>
                      {selected && (question.type === 'MULTIPLE_CHOICE'
                        ? <CheckCircle2 size={10} />
                        : <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    {opt.text}
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={13} /> Previous
              </button>

              {currentIdx < questions.length - 1 ? (
                <button onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))} className="btn-primary">
                  Next <ChevronRight size={13} />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="btn btn bg-emerald-600 text-white hover:opacity-90 shadow-sm disabled:opacity-50">
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 size={13} />}
                  Submit Test
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TakeTestPage() {
  return (
    <Suspense fallback={null}>
      <TakeTestContent />
    </Suspense>
  );
}
