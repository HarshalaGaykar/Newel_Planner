'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Rocket,
  TrendingUp,
  CalendarDays,
  IndianRupee,
  AlertCircle,
  Clock,
  Plus,
  Filter,
  Search,
  MoreHorizontal,
  Milestone,
  ArrowRight,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { projectsApi, Project, ProjectStatus, ProjectType } from '@/lib/projects-api';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type ProposalForm = {
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  startDate: string;
};

const defaultProposal = (): ProposalForm => ({
  name: '',
  description: '',
  type: ProjectType.DEVELOPMENT,
  status: ProjectStatus.DRAFT,
  startDate: new Date().toISOString().split('T')[0],
});

export default function FuturePlanningPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProposal, setNewProposal] = useState<ProposalForm>(defaultProposal);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectsApi.getAll();
      setProjects(
        data.filter(
          (p) =>
            ![
              ProjectStatus.CLOSED,
              ProjectStatus.ARCHIVED,
              ProjectStatus.CANCELLED,
              ProjectStatus.INACTIVE,
            ].includes(p.status),
        ),
      );
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchProjects();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchProjects]);

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProposal.name) return;
    try {
      setIsSubmitting(true);
      await projectsApi.create(newProposal);
      setIsModalOpen(false);
      setNewProposal(defaultProposal());
      await fetchProjects();
    } catch (err) {
      console.error('Failed to create proposal', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBudget = projects.reduce((sum, p) => sum + (p.milestones?.reduce((ms, m) => ms + m.amount, 0) || 0), 0);

  const stats = [
    { label: 'Pipeline Value', value: `₹${(totalBudget / 1000).toFixed(0)}K`, icon: IndianRupee, bg: 'bg-emerald-50 text-emerald-600' },
    { label: 'Upcoming', value: projects.length.toString(), icon: Rocket, bg: 'bg-blue-50 text-blue-600' },
    { label: 'Capacity Gap', value: '3 FTE', icon: AlertCircle, bg: 'bg-rose-50 text-rose-600' },
    { label: 'In Planning', value: projects.filter((p) => p.status === ProjectStatus.DRAFT).length.toString(), icon: Clock, bg: 'bg-amber-50 text-amber-600' },
  ];

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.ACTIVE:  return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case ProjectStatus.DRAFT:   return 'bg-amber-50 text-amber-600 border-amber-200';
      case ProjectStatus.ON_HOLD: return 'bg-rose-50 text-rose-600 border-rose-200';
      default:                    return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Milestone size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Strategic Roadmap</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Forecast initiatives and align with organizational capacity.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors',
              showTimeline ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted'
            )}
          >
            <CalendarDays size={12} /> Timeline
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            <Plus size={13} /> New Proposal
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card border rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', stat.bg)}>
                <stat.icon size={14} />
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {showTimeline && (
        <div className="bg-card border rounded-lg p-4 shadow-sm overflow-x-auto">
          <h3 className="text-xs font-semibold text-muted-foreground mb-4">Quarterly Pipeline</h3>
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No active roadmap data</p>
          ) : (() => {
            const now = new Date();
            const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const windowEnd = new Date(now.getFullYear(), now.getMonth() + 9, 1);
            const windowMs = windowEnd.getTime() - windowStart.getTime();

            const quarters: string[] = [];
            for (let i = 0; i < 3; i++) {
              const d = new Date(windowStart.getFullYear(), windowStart.getMonth() + i * 3, 1);
              quarters.push(`Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`);
            }

            const gradients = [
              'from-blue-500 to-indigo-500',
              'from-emerald-400 to-teal-500',
              'from-rose-400 to-red-500',
              'from-amber-400 to-orange-500',
              'from-purple-500 to-violet-500',
            ];

            return (
              <div className="min-w-[700px] space-y-2">
                <div className="flex text-xs font-medium text-muted-foreground mb-2 border-b pb-1.5">
                  <div className="w-36 shrink-0">Initiative</div>
                  {quarters.map((q) => (
                    <div key={q} className="flex-1 text-center border-l">{q}</div>
                  ))}
                </div>
                {projects.slice(0, 8).map((project, idx) => {
                  const start = project.startDate ? new Date(project.startDate) : windowStart;
                  const end = project.endDate ? new Date(project.endDate) : windowEnd;
                  const clampedStart = Math.max(start.getTime(), windowStart.getTime());
                  const clampedEnd = Math.min(end.getTime(), windowEnd.getTime());
                  const leftPct = Math.max(0, ((clampedStart - windowStart.getTime()) / windowMs) * 100);
                  const widthPct = Math.max(3, ((clampedEnd - clampedStart) / windowMs) * 100);
                  const grad = gradients[idx % gradients.length];
                  const isOutside = end.getTime() < windowStart.getTime() || start.getTime() > windowEnd.getTime();

                  return (
                    <div key={project.id} className="flex items-center h-5 relative">
                      <div className="w-36 shrink-0 text-xs font-medium truncate pr-3 text-foreground">{project.name}</div>
                      <div className="flex-1 relative h-full">
                        {!isOutside && (
                          <div
                            className={`absolute h-2.5 top-1 bg-gradient-to-r ${grad} rounded-full`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            title={`${project.name}: ${new Date(start).toLocaleDateString()} – ${project.endDate ? new Date(end).toLocaleDateString() : 'Ongoing'}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Project Pipeline Grid */}
      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 border-b flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
            <input
              type="text"
              placeholder="Filter roadmap..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field-input pl-8"
            />
          </div>
          <button className="btn-secondary">
            <Filter size={12} /> Filters
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-muted/30 border-b">
              <tr>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Initiative</th>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Phase</th>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Window</th>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Budget</th>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-center">Status</th>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {projects.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((project) => {
                const budget = project.milestones?.reduce((ms, m) => ms + m.amount, 0) || 0;
                const estBudget = budget > 0 ? `₹${(budget / 1000).toFixed(0)}K` : 'TBD';
                const phase = project.status === ProjectStatus.DRAFT ? 'Planning' : project.status === ProjectStatus.ACTIVE ? 'Live' : project.status;

                return (
                  <tr key={project.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3">
                      <button onClick={() => router.push(`/projects/${project.id}`)} className="text-left group">
                        <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{project.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{project.type}</p>
                      </button>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs text-foreground/70 flex items-center gap-1.5">
                        <TrendingUp size={11} className="text-primary" />
                        {phase}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 text-xs text-foreground">
                        <span>{new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                        <ArrowRight size={10} className="text-muted-foreground" />
                        <span>{project.endDate ? new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'TBD'}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs font-medium">{estBudget}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full border inline-block', getStatusBadge(project.status))}>
                        {project.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
                      >
                        <MoreHorizontal size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border rounded-lg p-4 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">New Project Proposal</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-muted rounded transition-colors">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="space-y-3">
              <div>
                <label className="form-label">Project Name *</label>
                <input
                  required
                  className="field-input"
                  value={newProposal.name}
                  onChange={(e) => setNewProposal({ ...newProposal, name: e.target.value })}
                  placeholder="Initiative name..."
                />
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  className="field-textarea"
                  value={newProposal.description}
                  onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                  placeholder="High-level objectives..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Project Type</label>
                  <select
                    className="field-select"
                    value={newProposal.type}
                    onChange={(e) => setNewProposal({ ...newProposal, type: e.target.value as ProjectType })}
                  >
                    <option value={ProjectType.DEVELOPMENT}>Development</option>
                    <option value={ProjectType.MAINTENANCE}>Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="field-input"
                    value={newProposal.startDate}
                    onChange={(e) => setNewProposal({ ...newProposal, startDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Submit Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
