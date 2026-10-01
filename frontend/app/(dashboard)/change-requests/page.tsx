'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  FileText,
  Trash2,
  Pencil,
  Loader2,
  ChevronRight,
  History,
  Activity,
  ListTodo,
  Lock
} from 'lucide-react';
import { changeRequestsApi, ChangeRequest } from '@/lib/change-requests-api';
import { workflowApi } from '@/lib/workflow-api';
import { useAuthStore } from '@/lib/store/auth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import DocumentPanel from '@/components/documents/DocumentPanel';

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  DRAFT:       { bg: 'bg-muted',        text: 'text-muted-foreground', icon: Pencil },
  SUBMITTED:   { bg: 'bg-blue-50',      text: 'text-blue-600',         icon: Clock },
  APPROVED:    { bg: 'bg-emerald-50',   text: 'text-emerald-600',      icon: CheckCircle2 },
  REJECTED:    { bg: 'bg-red-50',       text: 'text-red-600',          icon: XCircle },
  IN_PROGRESS: { bg: 'bg-violet-50',    text: 'text-violet-600',       icon: Activity },
  CLOSED:      { bg: 'bg-secondary',    text: 'text-muted-foreground', icon: Lock },
  DEFERRED:    { bg: 'bg-amber-50',     text: 'text-amber-600',        icon: Clock },
  ON_HOLD:     { bg: 'bg-orange-50',    text: 'text-orange-600',       icon: Clock },
};

const PHASE_STYLES: Record<string, string> = {
  REQUIREMENT: 'bg-blue-100 text-blue-700',
  DESIGN:      'bg-purple-100 text-purple-700',
  DEVELOPMENT: 'bg-orange-100 text-orange-700',
  TESTING:     'bg-yellow-100 text-yellow-700',
  UAT:         'bg-teal-100 text-teal-700',
  DEPLOYMENT:  'bg-emerald-100 text-emerald-700',
};

const PHASE_ORDER = ['REQUIREMENT', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'UAT', 'DEPLOYMENT'];

const TYPE_STYLES: Record<string, string> = {
  SCOPE: 'bg-purple-100 text-purple-700',
  BUDGET: 'bg-emerald-100 text-emerald-700',
  TIMELINE: 'bg-blue-100 text-blue-700',
  RESOURCE: 'bg-orange-100 text-orange-700',
  COMBINED: 'bg-red-100 text-red-700',
};

export default function ChangeRequestsPage() {
  const { user } = useAuthStore();
  const [crs, setCrs] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [selectedCr, setSelectedCr] = useState<ChangeRequest | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  
  const [newCr, setNewCr] = useState<any>({
    projectId: '',
    title: '',
    type: 'SCOPE',
    description: '',
    impactedScope: '',
    budgetDelta: '',
    timelineDeltaDays: '',
  });

  const [projects, setProjects] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([]);
  const [pendingWorkflows, setPendingWorkflows] = useState<any[]>([]);

  const loadCrs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await changeRequestsApi.getAll();
      setCrs(data);
    } catch (error) {
      console.error('Failed to load CRs', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingWorkflows = useCallback(async () => {
    try {
      const data = await workflowApi.getPending();
      setPendingWorkflows(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadCrs();
    loadPendingWorkflows();
    api.get('/projects').then(res => setProjects(res.data));
  }, [loadCrs, loadPendingWorkflows]);

  const handleCreateCr = async () => {
    try {
      await changeRequestsApi.create({
        ...newCr,
        budgetDelta: newCr.budgetDelta ? Number(newCr.budgetDelta) : undefined,
        timelineDeltaDays: newCr.timelineDeltaDays ? Number(newCr.timelineDeltaDays) : undefined,
      });
      setIsNewModalOpen(false);
      setNewCr({
        projectId: '',
        title: '',
        type: 'SCOPE',
        description: '',
        impactedScope: '',
        budgetDelta: '',
        timelineDeltaDays: '',
      });
      loadCrs();
    } catch (error) {
      alert('Failed to create CR');
    }
  };

  const handleSubmitCr = async (id: string) => {
    if (!confirm('Are you sure you want to submit this CR for approval?')) return;
    try {
      await changeRequestsApi.submit(id);
      loadCrs();
      loadPendingWorkflows();
      if (selectedCr?.id === id) {
        const updated = await changeRequestsApi.getOne(id);
        setSelectedCr(updated);
        fetchWorkflowHistory(id);
      }
    } catch (error) {
      alert('Failed to submit CR');
    }
  };

  const handleWorkflowAction = async (action: string) => {
    if (!selectedCr) return;
    const pendingInstance = pendingWorkflows.find(w => w.entityId === selectedCr.id && w.entityType === 'CR');
    if (!pendingInstance) return;

    try {
      await workflowApi.takeAction(pendingInstance.id, action, `User action: ${action}`);
      loadCrs();
      loadPendingWorkflows();
      const updated = await changeRequestsApi.getOne(selectedCr.id);
      setSelectedCr(updated);
      fetchWorkflowHistory(selectedCr.id);
    } catch (error) {
      alert(`Failed to ${action} CR`);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedCr) return;
    try {
      await changeRequestsApi.update(selectedCr.id, { status: newStatus as any });
      await loadCrs();
      const updated = await changeRequestsApi.getOne(selectedCr.id);
      setSelectedCr(updated);
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleCloseCr = async (id: string) => {
    if (!confirm('Mark this CR as Closed?')) return;
    try {
      await changeRequestsApi.close(id);
      loadCrs();
      if (selectedCr?.id === id) {
        const updated = await changeRequestsApi.getOne(id);
        setSelectedCr(updated);
      }
    } catch (error) {
      alert('Failed to close CR');
    }
  };

  const handleAddComment = async () => {
    if (!selectedCr || !comment.trim()) return;
    try {
      const newComment = await changeRequestsApi.addComment(selectedCr.id, comment);
      setSelectedCr({
        ...selectedCr,
        comments: [newComment, ...(selectedCr.comments || [])]
      });
      setComment('');
    } catch (error) {
      alert('Failed to add comment');
    }
  };

  const fetchWorkflowHistory = async (crId: string) => {
    try {
      const res = await api.get(`/workflow/history/CR/${crId}`);
      setWorkflowHistory(res.data);
    } catch (error) {
      setWorkflowHistory([]);
    }
  };

  const handleSelectCr = async (cr: ChangeRequest) => {
    const fullCr = await changeRequestsApi.getOne(cr.id);
    setSelectedCr(fullCr);
    fetchWorkflowHistory(cr.id);
  };

  const filteredCrs = crs.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || 
                          c.crCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-4 overflow-hidden">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-black tracking-tight uppercase">Change Requests</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Enterprise-wide scope, budget, and timeline governance</p>
          </div>
          <button 
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold shadow-sm hover:opacity-90 transition-all active:scale-95"
          >
            <Plus size={14} /> New CR
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input 
              className="w-full bg-secondary/20 border rounded-lg px-3 py-1.5 text-xs pl-9 focus:ring-1 focus:ring-primary outline-none"
              placeholder="Search by CR code or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="bg-secondary/20 border rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* List */}
        <div className={cn(
          "flex-1 overflow-y-auto min-h-0 transition-all",
          selectedCr ? "hidden lg:grid lg:grid-cols-1" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
          "gap-3 pr-1"
        )}>
          {loading ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : filteredCrs.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground bg-card border border-dashed rounded-xl">
              <Activity size={48} className="opacity-10 mb-4" />
              <p className="text-sm font-medium">No change requests found</p>
            </div>
          ) : (
            filteredCrs.map((c) => (
              <div 
                key={c.id} 
                className={cn(
                  "bg-card border rounded-lg p-3 hover:border-primary/40 transition-all cursor-pointer group flex flex-col h-max",
                  selectedCr?.id === c.id && "ring-2 ring-primary/20 border-primary bg-primary/5"
                )}
                onClick={() => handleSelectCr(c)}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10px] text-primary tracking-widest uppercase">{c.crCode}</span>
                    <div className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-tighter",
                      STATUS_STYLES[c.status]?.bg,
                      STATUS_STYLES[c.status]?.text
                    )}>
                      {c.status}
                    </div>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-bold opacity-40">{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                
                <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1 mb-2">{c.title}</h3>
                
                <div className="text-[10px] text-muted-foreground mb-3 line-clamp-1">
                  <span className="font-black text-primary/60">{c.project?.name || 'N/A'}</span>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold border-t pt-2 mt-auto">
                  <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter", TYPE_STYLES[c.type])}>
                    {c.type}
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black">
                      {c.requester.firstName[0]}{c.requester.lastName[0]}
                    </div>
                    <span className="opacity-60">{c.requester.firstName}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      {/* Right Side: Details */}
      {selectedCr && (
        <div className="w-full lg:w-[450px] flex flex-col bg-card border rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b flex justify-between items-center bg-secondary/20">
            <div>
              <div className="text-xs font-black text-primary tracking-widest uppercase mb-1">{selectedCr.crCode}</div>
              <h2 className="font-bold text-base leading-tight">{selectedCr.title}</h2>
            </div>
            <button onClick={() => setSelectedCr(null)} className="p-1.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground">
              <XCircle size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Action Buttons */}
            <div className="flex gap-2">
              {selectedCr.status === 'DRAFT' && (
                <>
                  <button 
                    onClick={() => handleSubmitCr(selectedCr.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Send size={14} /> Submit
                  </button>
                  <button className="p-2 border rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
                    <Trash2 size={16} />
                  </button>
                </>
              )}

              {/* Workflow Actions */}
              {selectedCr.status === 'SUBMITTED' && pendingWorkflows.some(w => w.entityId === selectedCr.id && w.entityType === 'CR') && (
                <>
                  <button
                    onClick={() => handleWorkflowAction('APPROVE')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleWorkflowAction('REJECT')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </>
              )}

              {['APPROVED', 'IN_PROGRESS'].includes(selectedCr.status) && (
                <button
                  onClick={() => handleCloseCr(selectedCr.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-secondary border text-muted-foreground rounded-xl text-xs font-bold hover:bg-muted transition-colors"
                >
                  <Lock size={14} /> Close CR
                </button>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Status</p>
                {['ADMIN', 'PM', 'TL'].includes(user?.role || '') ? (
                  <select 
                    className={cn("text-xs font-bold bg-transparent border-none p-0 focus:ring-0 cursor-pointer", STATUS_STYLES[selectedCr.status]?.text)}
                    value={selectedCr.status}
                    onChange={(e) => handleStatusUpdate(e.target.value)}
                  >
                    {Object.keys(STATUS_STYLES).map(s => (
                      <option key={s} value={s} className="bg-background text-foreground font-medium">{s}</option>
                    ))}
                  </select>
                ) : (
                  <div className={cn("text-xs font-bold", STATUS_STYLES[selectedCr.status]?.text)}>
                    {selectedCr.status}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Type</p>
                <div className={cn("text-xs px-2 py-0.5 rounded font-bold w-max", TYPE_STYLES[selectedCr.type])}>
                  {selectedCr.type}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Project</p>
                <div className="text-xs font-bold">{selectedCr.project.name}</div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Budget Delta</p>
                <div className={cn("text-xs font-bold", (selectedCr.budgetDelta || 0) > 0 ? "text-red-600" : (selectedCr.budgetDelta || 0) < 0 ? "text-emerald-600" : "")}>
                  {(selectedCr.budgetDelta || 0) > 0 ? '+' : ''}{selectedCr.budgetDelta || 0}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Timeline Delta</p>
                <div className={cn("text-xs font-bold", (selectedCr.timelineDeltaDays || 0) > 0 ? "text-red-600" : "")}>
                  {(selectedCr.timelineDeltaDays || 0) > 0 ? '+' : ''}{selectedCr.timelineDeltaDays || 0} Days
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Description</p>
              <p className="text-xs leading-relaxed text-foreground/80 bg-secondary/30 p-3 rounded-xl border border-dashed">
                {selectedCr.description || 'No description provided.'}
              </p>
            </div>
            
            {/* Impacted Scope */}
            {selectedCr.impactedScope && (
              <div className="space-y-2">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Impacted Scope</p>
                <p className="text-xs leading-relaxed text-foreground/80 bg-secondary/30 p-3 rounded-xl border border-dashed">
                  {selectedCr.impactedScope}
                </p>
              </div>
            )}

            {/* Tasks by Phase */}
            {selectedCr.tasks && selectedCr.tasks.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                  <ListTodo size={12} /> Implementation Tasks
                </div>
                {PHASE_ORDER.filter(ph => selectedCr.tasks!.some(t => t.phase === ph || (!t.phase && ph === 'DEVELOPMENT'))).map(ph => {
                  const phaseTasks = selectedCr.tasks!.filter(t => t.phase === ph || (!t.phase && ph === 'DEVELOPMENT' && !PHASE_ORDER.some(p => t.phase === p)));
                  if (phaseTasks.length === 0) return null;
                  const done = phaseTasks.filter(t => t.status === 'COMPLETED').length;
                  const pct = Math.round((done / phaseTasks.length) * 100);
                  return (
                    <div key={ph} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-black uppercase tracking-tighter', PHASE_STYLES[ph] || 'bg-muted text-muted-foreground')}>
                          {ph}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground">{done}/{phaseTasks.length} done</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1">
                        <div className="bg-primary h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="space-y-1">
                        {phaseTasks.map(t => (
                          <div key={t.id} className="flex items-center justify-between text-xs bg-secondary/30 px-2 py-1 rounded-lg">
                            <span className={cn('font-medium', t.status === 'COMPLETED' ? 'line-through text-muted-foreground' : '')}>{t.title}</span>
                            <span className="text-muted-foreground font-bold">{t.progressPct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Tasks without a phase */}
                {selectedCr.tasks.filter(t => !t.phase).length > 0 && !PHASE_ORDER.some(ph => selectedCr.tasks!.some(t => t.phase === ph)) && (
                  <div className="space-y-1">
                    {selectedCr.tasks.filter(t => !t.phase).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs bg-secondary/30 px-2 py-1 rounded-lg">
                        <span className={cn('font-medium', t.status === 'COMPLETED' ? 'line-through text-muted-foreground' : '')}>{t.title}</span>
                        <span className="text-muted-foreground font-bold">{t.progressPct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Workflow History */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                <History size={12} /> Workflow History
              </div>
              <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
                {workflowHistory.length > 0 ? workflowHistory.map((h: any, i: number) => (
                  <div key={i} className="relative pl-6">
                    <div className={cn(
                      "absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 bg-background flex items-center justify-center z-10",
                      h.status === 'APPROVED' ? "border-emerald-500" : "border-border"
                    )}>
                      {h.status === 'APPROVED' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </div>
                    <div className="text-xs">
                      <span className="font-bold">{h.status}</span> by <span className="text-muted-foreground">{h.requester?.firstName}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(h.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <div className="pl-6 text-xs text-muted-foreground italic">No workflow history yet.</div>
                )}
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                <MessageSquare size={12} /> Comments
              </div>
              
              <div className="flex gap-2">
                <input 
                  className="flex-1 border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button 
                  onClick={handleAddComment}
                  className="p-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>

              <div className="space-y-4 pt-2">
                {selectedCr.comments?.map((c) => (
                  <div key={c.id} className="bg-secondary/20 p-3 rounded-xl border border-transparent hover:border-border transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold">{c.author.firstName} {c.author.lastName}</span>
                      <span className="text-xs text-muted-foreground font-medium">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-snug">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div className="space-y-4 pt-4 border-t">
              <DocumentPanel entityType="CR" entityId={selectedCr.id} />
            </div>
      </div>
    </div>
  )}
      </div>

  {/* New CR Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-2xl p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-black tracking-tight uppercase mb-6 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Plus size={20} />
              </div>
              Create Change Request
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Project *</label>
                <select 
                  className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-background"
                  value={newCr.projectId}
                  onChange={(e) => setNewCr({...newCr, projectId: e.target.value})}
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Title *</label>
                  <input 
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={newCr.title}
                    onChange={(e) => setNewCr({...newCr, title: e.target.value})}
                    placeholder="e.g. Add Payment Gateway"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Type *</label>
                  <select 
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-background"
                    value={newCr.type}
                    onChange={(e) => setNewCr({...newCr, type: e.target.value})}
                  >
                    <option value="SCOPE">Scope</option>
                    <option value="BUDGET">Budget</option>
                    <option value="TIMELINE">Timeline</option>
                    <option value="RESOURCE">Resource</option>
                    <option value="COMBINED">Combined</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea 
                  className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[80px]"
                  value={newCr.description}
                  onChange={(e) => setNewCr({...newCr, description: e.target.value})}
                  placeholder="Reason for change..."
                />
              </div>

              {['SCOPE', 'COMBINED'].includes(newCr.type) && (
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Impacted Scope</label>
                  <textarea 
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[60px]"
                    value={newCr.impactedScope}
                    onChange={(e) => setNewCr({...newCr, impactedScope: e.target.value})}
                    placeholder="Details of scope changes..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {['BUDGET', 'COMBINED'].includes(newCr.type) && (
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Budget Delta (₹)</label>
                    <input 
                      type="number"
                      className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={newCr.budgetDelta}
                      onChange={(e) => setNewCr({...newCr, budgetDelta: e.target.value})}
                      placeholder="+/- Amount"
                    />
                  </div>
                )}
                {['TIMELINE', 'COMBINED'].includes(newCr.type) && (
                  <div>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Timeline Delta (Days)</label>
                    <input 
                      type="number"
                      className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={newCr.timelineDeltaDays}
                      onChange={(e) => setNewCr({...newCr, timelineDeltaDays: e.target.value})}
                      placeholder="+/- Days"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setIsNewModalOpen(false)}
                className="px-6 py-2.5 text-xs font-bold border rounded-xl hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateCr}
                disabled={!newCr.projectId || !newCr.title}
                className="px-6 py-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
              >
                Create CR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
