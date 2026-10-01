'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Calendar, TrendingUp, CheckCircle2,
  UserMinus, MoreHorizontal, Loader2, Clock, Tag, User,
  ExternalLink, Mail, CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import Link from 'next/link';

interface Skill          { id: string; name: string }
interface ResourceAlloc  { projectName: string; endDate: string }
interface Resource {
  userId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  skills: Skill[];
  isAllocated: boolean;
  allocations: ResourceAlloc[];
}
interface UpcomingFreeItem {
  resource: string | null;
  resourceId: string | null;
  project: string;
  endDate: string;
  daysUntilFree: number;
  skills: string[];
}

const PROJECT_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];

function getStatus(isAllocated: boolean): string {
  return isAllocated ? 'Allocated' : 'Available';
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Available':    return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'Allocated':    return 'bg-blue-50 text-blue-600 border-blue-200';
    default:             return 'bg-muted text-muted-foreground border-border';
  }
}

function avatarInitials(name: string) {
  return name.split(' ').map((n) => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function ProjectChips({ allocations }: { allocations: ResourceAlloc[] }) {
  if (allocations.length === 0) {
    return <span className="text-xs text-muted-foreground/60">Not allocated</span>;
  }
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-1">
      {allocations.map((a, i) => (
        <span key={i} className="text-xs text-foreground/80 flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-sm inline-block', PROJECT_COLORS[i % PROJECT_COLORS.length])} />
          {a.projectName}
        </span>
      ))}
    </div>
  );
}

function UpcomingFreeCard({ item }: { item: UpcomingFreeItem }) {
  const urgent = item.daysUntilFree <= 2;
  return (
    <div className={cn(
      'shrink-0 w-44 rounded-lg border p-2.5 flex flex-col gap-1 shadow-sm',
      urgent ? 'border-amber-300 bg-amber-50/60' : 'border-border bg-card',
    )}>
      <div className="flex items-center justify-between gap-1">
        <p className="font-medium text-xs truncate flex-1">{item.resource ?? 'Freelancer'}</p>
        <span className={cn(
          'text-xs font-medium px-1.5 py-0.5 rounded border shrink-0',
          urgent ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-muted text-muted-foreground border-border',
        )}>
          {item.daysUntilFree === 0 ? 'Today' : `${item.daysUntilFree}d`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground truncate">{item.project}</p>
      <p className="text-xs text-muted-foreground/70">
        Ends {new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </p>
      {item.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {item.skills.slice(0, 3).map((s) => (
            <span key={s} className="text-xs px-1 py-0.5 bg-primary/5 text-primary rounded border border-primary/10">{s}</span>
          ))}
          {item.skills.length > 3 && (
            <span className="text-xs text-muted-foreground">+{item.skills.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResourceAvailabilityPage() {
  const [searchTerm, setSearchTerm]       = useState('');
  const [resources, setResources]         = useState<Resource[]>([]);
  const [upcomingFree, setUpcomingFree]   = useState<UpcomingFreeItem[]>([]);
  const [allSkills, setAllSkills]         = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading]             = useState(true);
  const [freeLoading, setFreeLoading]     = useState(true);
  const [activeMenuId, setActiveMenuId]   = useState<string | null>(null);

  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { date: dateRange.start };
      if (selectedSkills.length > 0) params.skillIds = selectedSkills.join(',');
      const { data } = await api.get<Resource[]>('/allocations/availability', { params });
      setResources(data);
    } catch (err) {
      console.error('Failed to load resource availability', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange.start, selectedSkills]);

  const fetchUpcoming = useCallback(async () => {
    try {
      setFreeLoading(true);
      const { data } = await api.get<UpcomingFreeItem[]>('/allocations/upcoming-free?days=7');
      setUpcomingFree(data);
    } catch (err) {
      console.error('Failed to load upcoming-free', err);
    } finally {
      setFreeLoading(false);
    }
  }, []);

  const fetchSkills = useCallback(async () => {
    try {
      const { data } = await api.get<Skill[]>('/skills');
      setAllSkills(data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources]);
  useEffect(() => { fetchUpcoming(); fetchSkills(); }, [fetchUpcoming, fetchSkills]);

  function toggleSkill(id: string) {
    setSelectedSkills((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  const filteredResources = resources.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.department.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const stats = {
    total:     resources.length,
    available: resources.filter((r) => !r.isAllocated).length,
    allocated: resources.filter((r) => r.isAllocated).length,
  };

  return (
    <div className="space-y-4 h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Resource Availability</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Workforce allocation and capacity planning insights.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-md border">
          <Calendar size={12} className="text-muted-foreground" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            className="bg-transparent text-xs outline-none cursor-pointer"
          />
          <span className="text-muted-foreground text-xs">→</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            className="bg-transparent text-xs outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Upcoming Free */}
      {(freeLoading || upcomingFree.length > 0) && (
        <div className="shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-amber-500" />
            <span className="text-xs font-medium text-foreground">Freeing Up This Week</span>
            {!freeLoading && (
              <span className="text-xs text-muted-foreground">{upcomingFree.length} allocation{upcomingFree.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {freeLoading ? (
            <div className="h-16 flex items-center justify-center">
              <Loader2 size={14} className="animate-spin text-primary/50" />
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {upcomingFree.map((item, i) => <UpcomingFreeCard key={i} item={item} />)}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 shrink-0">
        {[
          { title: 'Total Workforce', value: stats.total,     icon: Users,        bg: 'bg-blue-50 text-blue-600' },
          { title: 'Available',       value: stats.available, icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600' },
          { title: 'Allocated',       value: stats.allocated, icon: UserMinus,    bg: 'bg-blue-50 text-blue-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-card border rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', stat.bg)}>
                <stat.icon size={14} />
              </div>
              <span className="text-xs text-muted-foreground">{stat.title}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Skill Filter Chips */}
      {allSkills.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 flex-wrap">
          <Tag size={11} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Filter skills:</span>
          {allSkills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => toggleSkill(skill.id)}
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full border transition-all',
                selectedSkills.includes(skill.id)
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
              )}
            >
              {skill.name}
            </button>
          ))}
          {selectedSkills.length > 0 && (
            <button
              onClick={() => setSelectedSkills([])}
              className="px-2 py-0.5 text-xs font-medium rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-destructive hover:border-destructive transition-all"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Main Table */}
      <div className="flex-1 flex flex-col bg-card border rounded-lg shadow-sm overflow-hidden min-h-0">
        {/* Toolbar */}
        <div className="px-3 py-2.5 border-b flex flex-col sm:flex-row items-center gap-2 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
            <input
              type="text"
              placeholder="Filter by name, role, department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field-input pl-8"
            />
          </div>
          <div className="flex gap-2 items-center ml-auto">
            <span className="text-xs text-muted-foreground">
              {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''}
            </span>
            <button className="btn-secondary">
              <TrendingUp size={11} /> Sort
            </button>
          </div>
        </div>

        {/* Data Grid */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Loading resources...</p>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-muted/30 border-b">
                  <tr>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Resource</th>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Department</th>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Skills</th>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground min-w-[160px]">Allocation</th>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-center">Status</th>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredResources.map((resource) => {
                    const status = getStatus(resource.isAllocated);
                    const avatar = avatarInitials(resource.name);
                    return (
                      <tr key={resource.userId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs border border-primary/20">
                              {avatar}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-foreground">{resource.name}</p>
                              <p className="text-xs text-muted-foreground">{resource.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-xs text-foreground/70">{resource.department || '—'}</span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {resource.skills.slice(0, 3).map((skill) => (
                              <span
                                key={skill.id}
                                className={cn(
                                  'px-1.5 py-0.5 text-xs rounded border',
                                  selectedSkills.includes(skill.id)
                                    ? 'bg-primary/10 text-primary border-primary/20'
                                    : 'bg-muted text-muted-foreground border-border/50',
                                )}
                              >
                                {skill.name}
                              </span>
                            ))}
                            {resource.skills.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{resource.skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <ProjectChips allocations={resource.allocations} />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full border inline-flex items-center justify-center min-w-[72px]',
                            getStatusColor(status),
                          )}>
                            {status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right relative">
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === resource.userId ? null : resource.userId)}
                            className={cn(
                              'p-1 rounded transition-colors',
                              activeMenuId === resource.userId ? 'bg-primary text-white' : 'text-muted-foreground hover:text-primary hover:bg-muted',
                            )}
                          >
                            <MoreHorizontal size={13} />
                          </button>

                          {activeMenuId === resource.userId && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                              <div className="absolute right-3 top-8 w-44 bg-card border rounded-lg shadow-lg z-50 py-1">
                                <Link
                                  href={`/users?search=${resource.email}`}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                                >
                                  <User size={11} className="text-primary" /> View Profile
                                </Link>
                                <Link
                                  href="/resource-planning"
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                                >
                                  <CalendarRange size={11} className="text-emerald-500" /> Manage Allocations
                                </Link>
                                <a
                                  href={`mailto:${resource.email}`}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                                >
                                  <Mail size={11} className="text-blue-500" /> Contact Resource
                                </a>
                                <div className="h-px bg-border my-1" />
                                <Link
                                  href={`/users?search=${resource.email}`}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                                >
                                  <ExternalLink size={11} /> Resource History
                                </Link>
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredResources.length === 0 && (
                <div className="p-10 text-center flex flex-col items-center justify-center opacity-60">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mb-2">
                    <Search className="text-muted-foreground" size={16} />
                  </div>
                  <p className="text-xs font-medium">No resources found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your filters.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
