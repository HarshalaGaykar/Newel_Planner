'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Edit2, Loader2, AlertCircle, XCircle, CheckCircle2, Upload, X,
} from 'lucide-react';
import {
  getQuestionBank, createQuestion, updateQuestion, deleteQuestion, bulkCreateQuestions,
  Question, QuestionType, Difficulty, QuestionOption,
} from '@/lib/tests-api';
import { cn } from '@/lib/utils';

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  EASY: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HARD: 'bg-red-50 text-red-600',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Single Choice',
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
};

function QuestionForm({ bankId, question, onClose, onSave }: {
  bankId: string;
  question?: Question;
  onClose: () => void;
  onSave: () => void;
}) {
  const [text, setText] = useState(question?.text ?? '');
  const [type, setType] = useState<QuestionType>(question?.type ?? 'SINGLE_CHOICE');
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'MEDIUM');
  const [marks, setMarks] = useState(question?.marks ?? 1);
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [tags, setTags] = useState((question?.tags ?? []).join(', '));
  const [options, setOptions] = useState<QuestionOption[]>(
    question?.options?.length
      ? question.options
      : type === 'TRUE_FALSE'
      ? [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }]
      : [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }],
  );
  const [correctOptions, setCorrectOptions] = useState<string[]>(question?.correctOptions ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTypeChange = (t: QuestionType) => {
    setType(t);
    setCorrectOptions([]);
    if (t === 'TRUE_FALSE') {
      setOptions([{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }]);
    } else if (options.length < 2) {
      setOptions([{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }]);
    }
  };

  const addOption = () => setOptions((prev) => [...prev, { id: crypto.randomUUID(), text: '' }]);
  const updateOptionText = (id: string, t: string) => setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text: t } : o)));
  const removeOption = (id: string) => { setOptions((prev) => prev.filter((o) => o.id !== id)); setCorrectOptions((prev) => prev.filter((c) => c !== id)); };
  const toggleCorrect = (id: string) => {
    if (type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE') { setCorrectOptions([id]); }
    else { setCorrectOptions((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (correctOptions.length === 0) { setError('Select at least one correct answer'); return; }
    setLoading(true); setError('');
    try {
      const payload = {
        bankId, text, type, difficulty, marks, options, correctOptions,
        explanation: explanation || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (question) { await updateQuestion(question.id, payload); } else { await createQuestion(payload); }
      onSave();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save question');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex justify-center backdrop-blur-sm overflow-y-auto py-6 px-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-3xl shadow-lg h-fit mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">{question ? 'Edit Question' : 'Add Question'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Question Text *</label>
            <textarea required rows={3} className="field-textarea" placeholder="Enter your question here..."
              value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Type</label>
              <select className="field-select" value={type} onChange={(e) => handleTypeChange(e.target.value as QuestionType)}>
                <option value="SINGLE_CHOICE">Single Choice</option>
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                <option value="TRUE_FALSE">True / False</option>
              </select>
            </div>
            <div>
              <label className="form-label">Difficulty</label>
              <select className="field-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label className="form-label">Marks</label>
              <input type="number" min={1} className="field-input" value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">
                Options
                <span className="ml-2 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">
                  {type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE' ? 'Single correct' : 'Multiple correct'}
                </span>
              </label>
              {type !== 'TRUE_FALSE' && (
                <button type="button" onClick={addOption} className="text-xs text-primary flex items-center gap-1 hover:underline">
                  <Plus size={11} /> Add Option
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {options.map((opt, idx) => (
                <div key={opt.id} className={cn(
                  'flex items-center gap-2 p-2 rounded border transition-colors',
                  correctOptions.includes(opt.id) ? 'bg-emerald-50 border-emerald-300' : 'bg-muted/10 border-border'
                )}>
                  <button type="button" onClick={() => toggleCorrect(opt.id)} className={cn(
                    'w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors border',
                    correctOptions.includes(opt.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-background border-border text-muted-foreground'
                  )}>
                    {correctOptions.includes(opt.id) ? <CheckCircle2 size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
                  </button>
                  {type === 'TRUE_FALSE' ? (
                    <span className="flex-1 text-xs font-medium">{opt.text}</span>
                  ) : (
                    <input type="text" required className="flex-1 bg-transparent border-none focus:ring-0 text-xs"
                      placeholder={`Option ${idx + 1}...`} value={opt.text} onChange={(e) => updateOptionText(opt.id, e.target.value)} />
                  )}
                  {type !== 'TRUE_FALSE' && options.length > 2 && (
                    <button type="button" onClick={() => removeOption(opt.id)} className="p-1 hover:bg-red-50 text-red-500 rounded transition opacity-60 hover:opacity-100">
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Explanation (optional)</label>
              <textarea rows={2} className="field-textarea" placeholder="Explain the reasoning..."
                value={explanation} onChange={(e) => setExplanation(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Tags (comma-separated)</label>
              <input type="text" className="field-input" placeholder="e.g. basics, advanced..."
                value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {question ? 'Update Question' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkUploadModal({ bankId, onClose, onSave }: { bankId: string; onClose: () => void; onSave: () => void }) {
  const [data, setData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const questions = JSON.parse(data);
      if (!Array.isArray(questions)) throw new Error('Input must be a JSON array');
      await bulkCreateQuestions(bankId, questions);
      onSave();
    } catch (err: any) {
      setError(err.message || 'Invalid JSON format');
    } finally { setLoading(false); }
  };

  const template = JSON.stringify([{
    "text": "What is React?", "type": "SINGLE_CHOICE",
    "options": [{ "id": "1", "text": "A library" }, { "id": "2", "text": "A framework" }],
    "correctOptions": ["1"], "difficulty": "EASY", "marks": 1, "tags": ["react", "basics"]
  }], null, 2);

  return (
    <div className="fixed inset-0 z-[9999] flex justify-center backdrop-blur-sm overflow-y-auto py-6 px-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-3xl shadow-lg h-fit mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-sm font-semibold">Bulk Upload Questions</h2>
            <p className="text-xs text-muted-foreground">Paste JSON array of questions.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="form-label mb-0">JSON Data</label>
              <button type="button" onClick={() => setData(template)} className="text-xs text-primary hover:underline">
                Insert Template
              </button>
            </div>
            <textarea required rows={12} className="field-textarea font-mono text-xs"
              placeholder="[{ ... }, { ... }]" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-100 rounded flex items-center gap-2 text-red-600 text-xs">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading || !data.trim()} className="btn-primary">
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              Upload Questions
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QuestionBankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [bank, setBank] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editQuestion, setEditQuestion] = useState<Question | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBank(await getQuestionBank(id)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (qId: string) => {
    if (!confirm('Delete this question?')) return;
    try { await deleteQuestion(qId); load(); } catch { alert('Failed to delete'); }
  };

  if (loading) return (
    <div className="py-16 text-center flex flex-col items-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin/tests/question-banks" className="p-1.5 hover:bg-muted rounded transition text-muted-foreground">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-foreground">{bank?.name}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{bank?.questions?.length ?? 0} questions.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBulk(true)} className="btn-secondary">
              <Upload size={13} /> Bulk Upload
            </button>
            <button onClick={() => { setEditQuestion(undefined); setShowForm(true); }} className="btn-primary">
              <Plus size={13} /> Add Question
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {bank?.questions?.length === 0 && (
            <div className="py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No questions yet. Add your first question.
            </div>
          )}
          {bank?.questions?.map((q: Question, idx: number) => (
            <div key={q.id} className="bg-card border rounded-lg p-3 shadow-sm group hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground w-5 shrink-0 pt-0.5">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground mb-2">{q.text}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{TYPE_LABELS[q.type]}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', DIFFICULTY_STYLES[q.difficulty])}>{q.difficulty}</span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{q.marks} {q.marks === 1 ? 'mark' : 'marks'}</span>
                      {q.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(q.options as QuestionOption[]).map((opt) => (
                        <div key={opt.id} className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded text-xs border',
                          (q.correctOptions as string[]).includes(opt.id)
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-muted/40 border-transparent text-muted-foreground'
                        )}>
                          {(q.correctOptions as string[]).includes(opt.id) && <CheckCircle2 size={10} className="shrink-0" />}
                          {opt.text}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">{q.explanation}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button onClick={() => { setEditQuestion(q); setShowForm(true); }} className="p-1 hover:bg-blue-50 text-blue-600 rounded transition">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => handleDelete(q.id)} className="p-1 hover:bg-red-50 text-red-500 rounded transition">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <QuestionForm bankId={id} question={editQuestion} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); load(); }} />
      )}
      {showBulk && (
        <BulkUploadModal bankId={id} onClose={() => setShowBulk(false)} onSave={() => { setShowBulk(false); load(); }} />
      )}
    </>
  );
}
