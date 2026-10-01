'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, ClipboardList } from 'lucide-react';
import { createTest } from '@/lib/tests-api';

export default function NewTestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    duration: 30,
    totalMarks: 100,
    passingMarks: 50,
    instructions: '',
  });

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const test = await createTest({
        ...form,
        description: form.description || undefined,
        instructions: form.instructions || undefined,
      });
      router.push(`/admin/tests/${test.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create test');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/tests" className="p-1.5 hover:bg-muted rounded transition text-muted-foreground">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <ClipboardList size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">New Test</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Configure test parameters.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border rounded-lg p-4 shadow-sm space-y-3">
        <div>
          <label className="form-label">Test Title *</label>
          <input type="text" required className="field-input" placeholder="e.g. React Developer Assessment Q1 2025"
            value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea rows={2} className="field-textarea" placeholder="Brief description of the test..."
            value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">Duration (min)</label>
            <input type="number" min={1} required className="field-input"
              value={form.duration} onChange={(e) => set('duration', Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Total Marks</label>
            <input type="number" min={1} required className="field-input"
              value={form.totalMarks} onChange={(e) => set('totalMarks', Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Passing Marks</label>
            <input type="number" min={0} required className="field-input"
              value={form.passingMarks} onChange={(e) => set('passingMarks', Number(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="form-label">Instructions</label>
          <textarea rows={3} className="field-textarea" placeholder="Instructions shown to candidates before starting the test..."
            value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Link href="/admin/tests" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Create & Configure
          </button>
        </div>
      </form>
    </div>
  );
}
