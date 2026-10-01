'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ticketsApi, Ticket } from '@/lib/tickets-api';
import { projectsApi, Project, ProjectType } from '@/lib/projects-api';
import { useProjectStore } from '@/lib/store/project';
import api from '@/lib/api';
import { AssigneeMultiSelect, AssigneeOption } from '@/components/tasks/fields';
import {
  Ticket as TicketIcon, Plus, AlertCircle, Clock, CheckCircle2, CircleDashed,
  ChevronDown, ChevronRight, Loader2, X, Check, FolderOpen, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TicketsPage() {
  const { currentProject } = useProjectStore();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Project filter — default to currentProject if set
  const [filterProjectId, setFilterProjectId] = useState<string>(currentProject?.id || '');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState<Partial<Ticket>>({
    title: '',
    description: '',
    status: 'OPEN',
    priority: 'MEDIUM',
    type: 'L1',
    projectId: currentProject?.id || '',
    assigneeId: '',
    assigneeIds: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assignees are drawn from the selected project's allocated resources.
  const [projectAllocations, setProjectAllocations] = useState<Array<{ user: { id: string; firstName?: string; lastName?: string } }>>([]);

  useEffect(() => {
    if (!newTicket.projectId) { setProjectAllocations([]); return; }
    api.get(`/allocations?projectId=${newTicket.projectId}`)
      .then(({ data }) => setProjectAllocations(data))
      .catch(() => setProjectAllocations([]));
  }, [newTicket.projectId]);

  // Cap how many cards render per column to keep the DOM small on large boards.
  const COLUMN_PAGE_SIZE = 50;
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ticketsData, projectsData] = await Promise.all([
        ticketsApi.getTickets(filterProjectId || undefined),
        projectsApi.getAll(),
      ]);
      setTickets(ticketsData);
      setProjects(projectsData);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [filterProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep filter in sync when sidebar project changes
  useEffect(() => {
    if (currentProject?.id) setFilterProjectId(currentProject.id);
  }, [currentProject]);

  const handleProjectFilterChange = (projectId: string) => {
    setFilterProjectId(projectId);
  };

  const openModal = () => {
    setNewTicket({
      title: '',
      description: '',
      status: 'OPEN',
      priority: 'MEDIUM',
      type: 'L1',
      projectId: filterProjectId || currentProject?.id || '',
      assigneeId: '',
      assigneeIds: [],
    });
    setIsModalOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.title || !newTicket.projectId) return;
    try {
      setIsSubmitting(true);
      const payload = { ...newTicket };
      // Backend derives the primary assigneeId from assigneeIds; send the array only.
      payload.assigneeIds = newTicket.assigneeIds ?? [];
      delete payload.assigneeId;
      await ticketsApi.createTicket(payload);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create ticket. Ensure project is MAINTENANCE.');
      alert(err?.response?.data?.message || 'Failed to create ticket. Ensure project is MAINTENANCE.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    try {
      await ticketsApi.updateTicket(ticketId, { status: newStatus });
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    if (ticketId) {
      handleStatusChange(ticketId, newStatus);
    }
  };

  const columns = [
    { id: 'OPEN',        title: 'Open',         icon: <CircleDashed size={14} className="text-muted-foreground" /> },
    { id: 'IN_PROGRESS', title: 'In Progress',  icon: <Clock size={14} className="text-blue-500" /> },
    { id: 'RESOLVED',    title: 'Resolved',     icon: <AlertCircle size={14} className="text-purple-500" /> },
    { id: 'CLOSED',      title: 'Closed',       icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
  ];

  const maintenanceProjects = projects.filter(p => p.type === ProjectType.MAINTENANCE);
  const selectedProject = projects.find(p => p.id === filterProjectId);

  const priorityStyle: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    HIGH:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    MEDIUM:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    LOW:      'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-4 animate-in h-full flex flex-col min-h-0">

      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-center gap-4 shrink-0 px-2">
        <div>
          <h1 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
            <TicketIcon className="text-primary" size={18} />
            Tickets
          </h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em] mt-1">
            {selectedProject ? `Project: ${selectedProject.name}` : 'Global Overview'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Project filter dropdown */}
          <div className="relative group">
            <FolderOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors" size={14} />
            <select
              value={filterProjectId}
              onChange={e => handleProjectFilterChange(e.target.value)}
              className={cn(
                'appearance-none pl-8 pr-8 py-1.5 rounded-lg border text-xs font-black uppercase tracking-widest',
                'bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 cursor-pointer',
                'text-foreground shadow-sm transition-all hover:border-primary/40'
              )}
            >
              <option value="">All Maintenance</option>
              {maintenanceProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={12} />
          </div>

          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:opacity-90 transition-all hover:scale-105"
          >
            <Plus size={14} /> New Ticket
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        /* ── Board ── */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-hidden p-2">
          {columns.map(col => {
            const colTickets = tickets.filter(t => t.status === col.id);
            const visible = visibleCounts[col.id] ?? COLUMN_PAGE_SIZE;
            const shownTickets = colTickets.slice(0, visible);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex flex-col min-w-0 bg-muted/5 rounded-xl border border-border/50"
              >
                <div className="p-3 border-b flex justify-between items-center bg-muted/10">
                  <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    {col.icon}
                    {col.title}
                  </h2>
                  <span className="text-xs font-black bg-muted px-2 py-0.5 rounded-full opacity-60">
                    {colTickets.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-3 scroll-smooth">
                  {shownTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('ticketId', ticket.id)}
                      className="bg-card border border-border/60 p-3 rounded-lg shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing group"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-widest mr-1',
                          ticket.type === 'L1' ? 'bg-blue-100 text-blue-700' :
                          ticket.type === 'L2' ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        )}>
                          {ticket.type}
                        </span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-widest',
                          priorityStyle[ticket.priority] || priorityStyle.MEDIUM
                        )}>
                          {ticket.priority}
                        </span>
                        {(() => {
                          const people = ticket.ticketAssignees?.length
                            ? ticket.ticketAssignees.map(ta => ta.user)
                            : (ticket.assignee ? [ticket.assignee] : []);
                          if (people.length === 0) {
                            return <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center text-xs font-black border">?</div>;
                          }
                          return (
                            <div className="flex -space-x-1.5">
                              {people.slice(0, 3).map(p => (
                                <div key={p.id} title={`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()}
                                  className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center text-xs font-black border group-hover:border-primary/40 transition-colors">
                                  {`${p.firstName?.charAt(0) ?? ''}${p.lastName?.charAt(0) ?? ''}`.toUpperCase() || '?'}
                                </div>
                              ))}
                              {people.length > 3 && (
                                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-black border">+{people.length - 3}</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <h3 className="text-xs font-bold text-foreground leading-tight">{ticket.title}</h3>
                      {ticket.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed italic opacity-70">
                          {ticket.description}
                        </p>
                      )}
                      {/* Linked tasks chip */}
                      {(ticket as any).tasks?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(ticket as any).tasks.map((t: any) => (
                            <span
                              key={t.id}
                              className={cn(
                                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-widest border',
                                t.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                                  : t.status === 'WIP'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'bg-muted text-muted-foreground border-border'
                              )}
                            >
                              <Wrench size={8} />
                              {t.status}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t flex justify-between items-center">
                        <span className="text-xs font-black text-muted-foreground/60 uppercase tracking-tighter">
                          {ticket.project?.name || 'No Project'}
                        </span>
                        <div className="flex gap-1">
                          {columns.filter(c => c.id !== ticket.status).map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleStatusChange(ticket.id, c.id)}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors"
                              title={`Move to ${c.title}`}
                            >
                              <ChevronRight size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {colTickets.length > shownTickets.length && (
                    <button
                      onClick={() => setVisibleCounts(prev => ({ ...prev, [col.id]: visible + COLUMN_PAGE_SIZE }))}
                      className="w-full py-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary rounded-lg border border-dashed transition-colors"
                    >
                      Load more ({colTickets.length - shownTickets.length})
                    </button>
                  )}
                  {colTickets.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/30">
                      <TicketIcon size={24} strokeWidth={1} />
                      <p className="text-xs font-black uppercase mt-2">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-xl p-5 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-black text-sm uppercase tracking-tight">Create Ticket</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-muted rounded-full transition-colors"><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Title *</label>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                  value={newTicket.title}
                  onChange={e => setNewTicket({ ...newTicket, title: e.target.value })}
                  placeholder="Ticket title..."
                />
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[60px]"
                  value={newTicket.description || ''}
                  onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Ticket details..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">
                    Project * <span className="text-xs text-amber-600 font-bold">(Mnt)</span>
                  </label>
                  <select
                    required
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none"
                    value={newTicket.projectId}
                    onChange={e => setNewTicket({ ...newTicket, projectId: e.target.value })}
                  >
                    <option value="">Select</option>
                    {maintenanceProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Type</label>
                  <select
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none"
                    value={newTicket.type}
                    onChange={e => setNewTicket({ ...newTicket, type: e.target.value })}
                  >
                    <option value="L1">L1</option>
                    <option value="L2">L2</option>
                    <option value="L3">L3</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                  <select
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none"
                    value={newTicket.priority}
                    onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <AssigneeMultiSelect
                  value={newTicket.assigneeIds ?? []}
                  onChange={ids => setNewTicket({ ...newTicket, assigneeIds: ids })}
                  options={projectAllocations.map((a): AssigneeOption => ({ id: a.user.id, label: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim() }))}
                  emptyHint="No allocated resources on this project. Allocate users first."
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg border hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:opacity-90 flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
