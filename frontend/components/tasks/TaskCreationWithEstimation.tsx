'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Sparkles, AlertCircle, TrendingUp } from 'lucide-react';

export default function TaskCreationWithEstimation() {
  const [form, setForm] = useState({
    title: '',
    activity: '',
    subActivity: '',
    complexity: 'MEDIUM',
  });
  
  const [suggestion, setSuggestion] = useState<{ suggestedHours: number; confidence: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (form.activity && form.subActivity && form.complexity) {
      setLoading(true);
      const timer = setTimeout(async () => {
        try {
          const res = await api.get('/estimation', { params: form });
          setSuggestion(res.data);
        } finally {
          setLoading(false);
        }
      }, 500); // Debounce
      return () => clearTimeout(timer);
    }
  }, [form.activity, form.subActivity, form.complexity]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-foreground tracking-tight">Create New Task</h1>
        <p className="text-muted-foreground mt-2">Intelligent effort estimation powered by historical data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card p-8 rounded-3xl border border-border shadow-xl">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Task Title</label>
                <input 
                  type="text" 
                  className="w-full p-4 rounded-xl border border-border bg-muted focus:bg-card focus:border-blue-500 outline-none transition font-bold"
                  placeholder="e.g. Implement OAuth Flow"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Activity</label>
                  <select 
                    className="w-full p-4 rounded-xl border border-border bg-muted outline-none transition font-bold"
                    value={form.activity}
                    onChange={e => setForm({ ...form, activity: e.target.value })}
                  >
                    <option value="">Select Activity</option>
                    <option value="DEVELOPMENT">Development</option>
                    <option value="TESTING">Testing</option>
                    <option value="DESIGN">Design</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Complexity</label>
                  <select 
                    className="w-full p-4 rounded-xl border border-border bg-muted outline-none transition font-bold"
                    value={form.complexity}
                    onChange={e => setForm({ ...form, complexity: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className={`bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-2xl transition-all duration-500 ${loading ? 'opacity-50 grayscale' : 'opacity-100'}`}>
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-blue-200" />
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-100">AI Suggestion</h3>
            </div>
            
            {suggestion ? (
              <div>
                <div className="text-5xl font-black mb-2">{suggestion.suggestedHours} <span className="text-xl font-bold opacity-60">hrs</span></div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-tighter opacity-80">
                  <TrendingUp className="w-3 h-3" />
                  Confidence: {suggestion.confidence}
                </div>
                
                <div className="mt-8 pt-8 border-t border-white/10">
                  <p className="text-xs font-medium text-blue-100 leading-relaxed italic">
                    "Based on 12 similar {form.complexity.toLowerCase()} complexity tasks in {form.activity.toLowerCase()}."
                  </p>
                  <button className="w-full mt-6 bg-card text-blue-600 font-black py-3 rounded-xl hover:bg-blue-50 transition shadow-lg shadow-blue-900/20">
                    Apply Estimate
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold opacity-40">Select activity and complexity to generate estimate.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
