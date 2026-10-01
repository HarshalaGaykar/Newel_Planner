'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi, Skill, SkillCategory } from '@/lib/admin-api';
import {
  Award, Edit2, Trash2, Plus,
  Loader2, AlertCircle,
  X, Search, Zap, CheckCircle2,
  Trophy, BookOpen, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

function SkillModal({
  skill,
  categories,
  onClose,
  onSave,
}: {
  skill?: Skill;
  categories: SkillCategory[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: skill?.name || '',
    categoryId: skill?.categoryId || '',
    description: skill?.description || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...formData,
        categoryId: formData.categoryId || null,
      };

      if (skill) {
        await adminApi.updateSkill(skill.id, payload);
      } else {
        await adminApi.createSkill(payload);
      }
      onSave();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save skill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-md shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">{skill ? 'Edit Skill' : 'New Skill'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="form-label">Skill Name *</label>
            <input type="text" required className="field-input" placeholder="e.g. Cloud Infrastructure"
              value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Category</label>
            <select className="field-select" value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea rows={3} className="field-textarea" placeholder="Brief description..."
              value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Award size={12} />}
              {skill ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SkillsMappingPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [categoryMeta, setCategoryMeta] = useState({
    totalCategories: 0,
    activeCategories: 0,
    inactiveCategories: 0,
    returnedCategories: 0,
    totalSkills: 0,
    categorizedSkills: 0,
    uncategorizedSkills: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsRes, categoriesRes] = await Promise.all([
        adminApi.getSkills(),
        adminApi.getSkillCategories(),
      ]);
      setSkills(skillsRes);
      setCategories(categoriesRes.data);
      setCategoryMeta(categoriesRes.meta);
    } catch (err) {
      console.error('Failed to fetch skills data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this skill?')) return;
    try {
      await adminApi.deleteSkill(id);
      fetchData();
    } catch (err) {
      alert('Failed to delete skill');
    }
  };

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Skills & Capabilities</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Enterprise talent and expertise index.</p>
          </div>
        </div>
        <button onClick={() => { setEditingSkill(undefined); setModalOpen(true); }} className="btn-primary">
          <Plus size={13} /> New Skill
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Skills', value: skills.length, icon: Trophy, bg: 'bg-muted text-foreground' },
          { label: 'Categories', value: categoryMeta.activeCategories, icon: Zap, bg: 'bg-blue-50 text-blue-600' },
          { label: 'Categorized', value: categoryMeta.categorizedSkills, icon: BookOpen, bg: 'bg-emerald-50 text-emerald-600' },
          { label: 'Uncategorized', value: categoryMeta.uncategorizedSkills, icon: Layers, bg: 'bg-purple-50 text-purple-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-card border rounded-lg p-3 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-semibold text-foreground mt-0.5">{stat.value}</p>
            </div>
            <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', stat.bg)}>
              <stat.icon size={14} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-lg p-3 shadow-sm flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search skills..." className="field-input pl-8"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 size={12} className="text-green-500" />
          Validated directory
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredSkills.map((skill) => (
            <div key={skill.id} className="bg-card border rounded-lg p-3 shadow-sm hover:border-primary/30 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Award size={14} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingSkill(skill); setModalOpen(true); }} className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors">
                    <Edit2 size={11} />
                  </button>
                  <button onClick={() => handleDelete(skill.id)} className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-foreground line-clamp-1">{skill.name}</h3>
                <span className="inline-block mt-0.5 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {skill.category?.name || 'Uncategorized'}
                </span>
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 min-h-[28px]">
                  {skill.description || 'No description.'}
                </p>
              </div>
            </div>
          ))}

          {filteredSkills.length === 0 && (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No skills found.
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <SkillModal
          skill={editingSkill}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSave={() => { setModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
}
