'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MessageSquare, 
  ArrowRightLeft,
  FileText,
  Calendar,
  User,
  Trash2,
  Pencil,
  Loader2,
  ChevronRight,
  History
} from 'lucide-react';
import { demandsApi, Demand, DemandComment } from '@/lib/demands-api';
import { useAuthStore } from '@/lib/store/auth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import DocumentPanel from '@/components/documents/DocumentPanel';
import { PermissionGuard } from '@/components/auth/PermissionGuard';


// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  DRAFT:        { bg: 'bg-muted',    text: 'text-muted-foreground',    icon: Pencil },
  SUBMITTED:    { bg: 'bg-blue-50',      text: 'text-blue-600',     icon: Clock },
  UNDER_REVIEW: { bg: 'bg-amber-50',     text: 'text-amber-600',    icon: Search },
  APPROVED:     { bg: 'bg-emerald-50',   text: 'text-emerald-600',  icon: CheckCircle2 },
  REJECTED:     { bg: 'bg-red-50',       text: 'text-red-600',      icon: XCircle },
  CONVERTED:    { bg: 'bg-purple-50',    text: 'text-purple-600',   icon: ArrowRightLeft },
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH:     'bg-orange-100 text-orange-700',
  MEDIUM:   'bg-blue-100 text-blue-700',
  LOW:      'bg-muted text-foreground',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DemandsPage() {
  const { user } = useAuthStore();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  
  const [newDemand, setNewDemand] = useState<any>({
    title: '',
    description: '',
    departmentId: '',
    priority: 'MEDIUM',
    estimatedBudget: '',
    estimatedTimeline: '',
  });

  const [convertData, setConvertData] = useState({
    startDate: '',
    pmId: '',
  });

  const [departments, setDepartments] = useState<any[]>([]);
  const [pms, setPms] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([]);

  const loadDemands = useCallback(async () => {
    setLoading(true);
    try {
      const data = await demandsApi.getAll();
      setDemands(data);
    } catch (error) {
      console.error('Failed to load demands', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDemands();
    api.get('/departments').then(res => setDepartments(res.data));
    api.get('/users').then(res => {
      setPms(res.data.filter((u: any) => ['PM', 'ADMIN', 'TL'].includes(u.role?.name || u.role)));
    });
  }, [loadDemands]);

  const handleCreateDemand = async () => {
    try {
      await demandsApi.create({
        ...newDemand,
        estimatedBudget: newDemand.estimatedBudget ? Number(newDemand.estimatedBudget) : undefined,
      });
      setIsNewModalOpen(false);
      setNewDemand({
        title: '',
        description: '',
        departmentId: '',
        priority: 'MEDIUM',
        estimatedBudget: '',
        estimatedTimeline: '',
      });
      loadDemands();
    } catch (error) {
      alert('Failed to create demand');
    }
  };

  const handleSubmitDemand = async (id: string) => {
    if (!confirm('Are you sure you want to submit this demand for approval?')) return;
    try {
      await demandsApi.submit(id);
      loadDemands();
      if (selectedDemand?.id === id) {
        const updated = await demandsApi.getOne(id);
        setSelectedDemand(updated);
      }
    } catch (error) {
      alert('Failed to submit demand');
    }
  };

  const handleConvert = async () => {
    if (!selectedDemand) return;
    try {
      await demandsApi.convert(selectedDemand.id, convertData);
      setIsConvertModalOpen(false);
      setSelectedDemand(null);
      loadDemands();
    } catch (error) {
      alert('Failed to convert demand');
    }
  };

  const handleAddComment = async () => {
    if (!selectedDemand || !comment.trim()) return;
    try {
      const newComment = await demandsApi.addComment(selectedDemand.id, comment);
      setSelectedDemand({
        ...selectedDemand,
        comments: [newComment, ...(selectedDemand.comments || [])]
      });
      setComment('');
    } catch (error) {
      alert('Failed to add comment');
    }
  };

  const fetchWorkflowHistory = async (demandId: string) => {
    try {
      const res = await api.get(`/workflow/history/DEMAND/${demandId}`);
      setWorkflowHistory(res.data);
    } catch (error) {
      setWorkflowHistory([]);
    }
  };

  const handleSelectDemand = async (demand: Demand) => {
    setSelectedDemand(demand);
    fetchWorkflowHistory(demand.id);
  };

  const filteredDemands = demands.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || 
                         d.demandCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 overflow-hidden">
      {/* Left Side: List */}
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all", selectedDemand ? "hidden lg:flex" : "flex")}>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Demand Intake</h1>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Manage business demands and project requests</p>
          </div>
          <PermissionGuard permission="DEMAND_CREATE">
            <button 
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
            >
              <Plus size={16} /> New Demand
            </button>
          </PermissionGuard>

        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 bg-card border rounded-xl p-2 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input 
              className="w-full bg-transparent border-none focus:ring-0 text-xs pl-9"
              placeholder="Search by code or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="h-4 w-px bg-border mx-1" />
          <select 
            className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto min-h-0 rounded-xl border bg-card shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : filteredDemands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText size={48} className="opacity-10 mb-4" />
              <p className="text-sm font-medium">No demands found</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-secondary/50 backdrop-blur-sm z-10 border-b text-xs font-black uppercase text-muted-foreground tracking-widest">
                <tr>
                  <th className="px-4 py-3">Code & Title</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDemands.map((d) => (
                  <tr 
                    key={d.id} 
                    className={cn(
                      "group hover:bg-secondary/30 transition-colors cursor-pointer",
                      selectedDemand?.id === d.id && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                    onClick={() => handleSelectDemand(d)}
                  >
                    <td className="px-4 py-4">
                      <div className="font-black text-xs text-primary tracking-tighter mb-0.5">{d.demandCode}</div>
                      <div className="text-xs font-bold text-foreground line-clamp-1">{d.title}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-medium text-muted-foreground">{d.department?.name || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-black uppercase tracking-tighter", PRIORITY_STYLES[d.priority])}>
                        {d.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {(() => { const StatusIcon = STATUS_STYLES[d.status]?.icon; return (
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border",
                          STATUS_STYLES[d.status]?.bg,
                          STATUS_STYLES[d.status]?.text
                        )}>
                          {StatusIcon && <StatusIcon size={10} />}
                          {d.status}
                        </div>
                      ); })()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black">
                          {d.requester.firstName[0]}{d.requester.lastName[0]}
                        </div>
                        <div className="text-xs font-medium">{d.requester.firstName} {d.requester.lastName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <ChevronRight className="inline text-muted-foreground/30 group-hover:text-primary transition-colors" size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right Side: Details */}
      {selectedDemand && (
        <div className="w-full lg:w-[450px] flex flex-col bg-card border rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b flex justify-between items-center bg-secondary/20">
            <div>
              <div className="text-xs font-black text-primary tracking-widest uppercase mb-1">{selectedDemand.demandCode}</div>
              <h2 className="font-bold text-base leading-tight">{selectedDemand.title}</h2>
            </div>
            <button onClick={() => setSelectedDemand(null)} className="p-1.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground">
              <XCircle size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Action Buttons */}
            <div className="flex gap-2">
              {selectedDemand.status === 'DRAFT' && (
                <>
                  <button 
                    onClick={() => handleSubmitDemand(selectedDemand.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Send size={14} /> Submit
                  </button>
                  <button className="p-2 border rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
              {selectedDemand.status === 'APPROVED' && (
                <PermissionGuard permission="DEMAND_CONVERT">
                  <button 
                    onClick={() => {
                      setConvertData({ startDate: '', pmId: '' });
                      setIsConvertModalOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors"
                  >
                    <ArrowRightLeft size={14} /> Convert to Project
                  </button>
                </PermissionGuard>
              )}
              {selectedDemand.status === 'CONVERTED' && selectedDemand.convertedProjectId && (
                <a 
                  href={`/projects/${selectedDemand.convertedProjectId}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2 border border-purple-200 bg-purple-50 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors"
                >
                  View Project <ChevronRight size={14} />
                </a>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Status</p>
                <div className={cn("text-xs font-bold", STATUS_STYLES[selectedDemand.status]?.text)}>
                  {selectedDemand.status}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Priority</p>
                <div className="text-xs font-bold">{selectedDemand.priority}</div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Budget</p>
                <div className="text-xs font-bold">₹{selectedDemand.estimatedBudget?.toLocaleString() || 'N/A'}</div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Target Date</p>
                <div className="text-xs font-bold">
                  {selectedDemand.estimatedTimeline ? new Date(selectedDemand.estimatedTimeline).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Description</p>
              <p className="text-xs leading-relaxed text-foreground/80 bg-secondary/30 p-3 rounded-xl border border-dashed">
                {selectedDemand.description || 'No description provided.'}
              </p>
            </div>

            {/* Remarks */}
            {selectedDemand.reviewerRemarks && (
              <div className="space-y-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs font-black text-red-600 uppercase tracking-widest">Reviewer Remarks</p>
                <p className="text-xs text-red-700 font-medium">{selectedDemand.reviewerRemarks}</p>
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
                {selectedDemand.comments?.map((c) => (
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
              <DocumentPanel entityType="DEMAND" entityId={selectedDemand.id} />
            </div>
          </div>
        </div>
      )}

      {/* New Demand Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-2xl p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-black tracking-tight uppercase mb-6 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Plus size={20} />
              </div>
              Create New Demand
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Title *</label>
                <input 
                  className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={newDemand.title}
                  onChange={(e) => setNewDemand({...newDemand, title: e.target.value})}
                  placeholder="e.g. Migration to AWS Cloud"
                />
              </div>
              
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea 
                  className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[100px]"
                  value={newDemand.description}
                  onChange={(e) => setNewDemand({...newDemand, description: e.target.value})}
                  placeholder="Provide more context about this request..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Department</label>
                  <select 
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-background"
                    value={newDemand.departmentId}
                    onChange={(e) => setNewDemand({...newDemand, departmentId: e.target.value})}
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                  <select 
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-background"
                    value={newDemand.priority}
                    onChange={(e) => setNewDemand({...newDemand, priority: e.target.value})}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Budget (₹)</label>
                  <input 
                    type="number"
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={newDemand.estimatedBudget}
                    onChange={(e) => setNewDemand({...newDemand, estimatedBudget: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Target Timeline</label>
                  <input 
                    type="date"
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={newDemand.estimatedTimeline}
                    onChange={(e) => setNewDemand({...newDemand, estimatedTimeline: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-10">
              <button 
                onClick={() => setIsNewModalOpen(false)}
                className="px-6 py-2.5 text-xs font-bold border rounded-xl hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateDemand}
                className="px-6 py-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
              >
                Create Demand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Project Modal */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-background border rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-black tracking-tight uppercase mb-6 flex items-center gap-2 text-purple-600">
              <ArrowRightLeft size={20} />
              Convert to Project
            </h2>
            
            <p className="text-xs text-muted-foreground mb-6">
              You are about to convert <span className="font-bold text-foreground">{selectedDemand?.demandCode}</span> into a full project. Please assign a Project Manager and set the start date.
            </p>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Start Date *</label>
                <input 
                  type="date"
                  className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={convertData.startDate}
                  onChange={(e) => setConvertData({...convertData, startDate: e.target.value})}
                />
              </div>
              
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Assign PM *</label>
                <select 
                  className="w-full border rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-background"
                  value={convertData.pmId}
                  onChange={(e) => setConvertData({...convertData, pmId: e.target.value})}
                >
                  <option value="">Select PM</option>
                  {pms.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-10">
              <button 
                onClick={() => setIsConvertModalOpen(false)}
                className="flex-1 py-2.5 text-xs font-bold border rounded-xl hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConvert}
                disabled={!convertData.startDate || !convertData.pmId}
                className="flex-[2] py-2.5 text-xs font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-purple-500/20"
              >
                Confirm & Convert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
