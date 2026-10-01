'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen, Plus, Trash2, ChevronRight, Loader2, Search, AlertCircle, X,
} from 'lucide-react';
import {
  getQuestionBanks, createQuestionBank, deleteQuestionBank, QuestionBank,
} from '@/lib/tests-api';

function BankModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createQuestionBank({ name, description: description || undefined });
      onSave();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create bank');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-md shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">New Question Bank</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>
        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="form-label">Bank Name *</label>
            <input type="text" required className="field-input" placeholder="e.g. React Fundamentals"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea rows={3} className="field-textarea" placeholder="Optional description..."
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Create Bank
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QuestionBanksPage() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBanks(await getQuestionBanks()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question bank and all its questions?')) return;
    try { await deleteQuestionBank(id); load(); } catch { alert('Failed to delete bank'); }
  };

  const visible = banks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Question Banks</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Reusable question repositories.</p>
          </div>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus size={13} /> New Bank
        </button>
      </div>

      <div className="bg-card border rounded-lg p-3 shadow-sm flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search banks..." className="field-input pl-8"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((bank) => (
            <div key={bank.id} className="bg-card border rounded-lg p-3 shadow-sm hover:border-primary/30 transition-colors group">
              <div className="flex justify-between items-start mb-3">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <BookOpen size={14} />
                </div>
                <button onClick={() => handleDelete(bank.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-500 rounded transition">
                  <Trash2 size={12} />
                </button>
              </div>
              <h3 className="text-xs font-semibold text-foreground line-clamp-1">{bank.name}</h3>
              {bank.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{bank.description}</p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground">{bank._count?.questions ?? 0} questions</span>
                <Link href={`/admin/tests/question-banks/${bank.id}`} className="flex items-center gap-1 text-xs text-primary hover:gap-2 transition-all">
                  Manage <ChevronRight size={11} />
                </Link>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No question banks found.
            </div>
          )}
        </div>
      )}

      {modal && <BankModal onClose={() => setModal(false)} onSave={() => { setModal(false); load(); }} />}
    </div>
  );
}
