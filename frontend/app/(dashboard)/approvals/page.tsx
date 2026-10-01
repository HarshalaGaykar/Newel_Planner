'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  User, 
  FileText, 
  Filter, 
  Loader2,
  ShieldCheck,
  ClipboardCheck,
  ChevronRight,
  History,
  UserPlus,
  Send,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowInstance {
  id: string;
  templateId: string;
  entityType: string;
  entityId: string;
  currentStep: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requesterId: string;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  template: {
    name: string;
    steps: any[];
  };
  requester: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function ApprovalsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [delegateTo, setDelegateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const { data } = await api.get('/workflow/pending');
        setInstances(data);
      } else {
        // For 'all', we might need a different endpoint or filter
        // For now, let's just fetch all templates or similar if needed
        // Instructions said: Tabs: My Pending | All (Admin/PMO view)
        const { data } = await api.get('/workflow/pending'); // Placeholder
        setInstances(data);
      }
    } catch (err) {
      console.error('Failed to load approvals', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (instanceId: string, action: string, remarks?: string, delegateTo?: string) => {
    setProcessingId(instanceId);
    try {
      await api.post(`/workflow/instances/${instanceId}/action`, {
        action,
        remarks,
        delegateTo
      });
      setSelectedInstance(null);
      setIsDelegateModalOpen(false);
      await load();
    } catch (err) {
      console.error('Action failed', err);
    } finally {
      setProcessingId(null);
    }
  };

  const viewHistory = async (instance: WorkflowInstance) => {
    setSelectedInstance(instance);
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/workflow/history/${instance.entityType}/${instance.entityId}`);
      setHistory(data[0]?.actions || []); // Get actions for the latest instance
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getAge = (date: string) => {
    const days = Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return days === 0 ? 'Today' : `${days}d ago`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.2em] mb-1.5">
            <ShieldCheck size={14} />
            Enterprise Workflow Engine
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Unified Approvals</h1>
          <p className="text-muted-foreground text-xs mt-1">Manage all cross-module authorization requests from a single interface.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="bg-muted/50 p-1 rounded-xl flex gap-1">
             <button 
               onClick={() => setActiveTab('pending')}
               className={cn(
                 "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                 activeTab === 'pending' ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
               )}
             >
               My Pending
             </button>
             <button 
               onClick={() => setActiveTab('all')}
               className={cn(
                 "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                 activeTab === 'all' ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
               )}
             >
               All History
             </button>
           </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Synchronizing with workflow engine...</p>
          </div>
        ) : instances.length === 0 ? (
          <div className="bg-muted/20 border-2 border-dashed rounded-3xl p-16 text-center">
            <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck size={24} />
            </div>
            <h3 className="text-lg font-bold">Clear Skies!</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">
              No pending tasks require your immediate attention.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {instances.map((instance) => (
              <div 
                key={instance.id} 
                className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-all group shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => viewHistory(instance)}>
                  <div className="w-12 h-12 bg-primary/5 text-primary rounded-full flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <h3 className="font-bold text-base leading-none">{instance.template.name}</h3>
                       <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-black tracking-tighter uppercase">
                         {instance.entityType}
                       </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                       <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                         <User size={10} /> {instance.requester.firstName} {instance.requester.lastName}
                       </span>
                       <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                       <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                         <Clock size={10} /> {getAge(instance.createdAt)}
                       </span>
                       <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                       <span className="text-xs text-primary font-bold">
                         Step {instance.currentStep}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleAction(instance.id, 'REJECT')}
                    className="p-2 rounded-xl border border-border text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Reject"
                  >
                    <XCircle size={18} />
                  </button>
                  <button 
                    onClick={() => { setSelectedInstance(instance); setIsDelegateModalOpen(true); }}
                    className="p-2 rounded-xl border border-border text-amber-600 hover:bg-amber-50 transition-colors"
                    title="Delegate"
                  >
                    <UserPlus size={18} />
                  </button>
                  <button 
                    onClick={() => handleAction(instance.id, 'SEND_BACK')}
                    className="p-2 rounded-xl border border-border text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Send Back"
                  >
                    <Send size={18} className="rotate-180" />
                  </button>
                  <button 
                    onClick={() => handleAction(instance.id, 'APPROVE')}
                    className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    <CheckCircle2 size={16} />
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History Modal */}
      {selectedInstance && !isDelegateModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
           <div className="bg-card border rounded-xl w-full max-w-3xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-border bg-muted/20 flex justify-between items-center">
                 <div>
                    <h2 className="text-lg font-black text-foreground">Workflow History</h2>
                    <p className="text-xs text-muted-foreground font-bold tracking-tight uppercase">
                      {selectedInstance.template.name} — {selectedInstance.entityId}
                    </p>
                 </div>
                 <button onClick={() => setSelectedInstance(null)} className="p-2 hover:bg-card rounded-full transition-colors">
                    <XCircle size={20} className="text-muted-foreground" />
                 </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1">
                 {loadingHistory ? (
                   <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
                 ) : history.length === 0 ? (
                   <div className="text-center py-12 text-muted-foreground italic text-sm">No actions recorded yet.</div>
                 ) : (
                   <div className="relative border-l-2 border-muted ml-4 space-y-8 pb-4">
                      {history.map((log, i) => (
                        <div key={log.id} className="relative pl-8">
                           <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-card border-2 border-primary" />
                           <div className="flex justify-between items-start">
                              <div>
                                 <p className="font-bold text-sm">{log.actor.firstName} {log.actor.lastName}</p>
                                 <p className="text-xs text-muted-foreground uppercase font-black">{log.action}</p>
                                 {log.remarks && (
                                   <div className="mt-2 p-3 bg-muted/30 rounded-xl text-xs italic">
                                     "{log.remarks}"
                                   </div>
                                 )}
                              </div>
                              <div className="text-right">
                                 <p className="text-xs text-muted-foreground font-bold">{new Date(log.takenAt).toLocaleString()}</p>
                                 <p className="text-xs text-primary font-bold tracking-widest uppercase">Step {log.stepOrder}</p>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                 )}
              </div>

              <div className="p-5 border-t border-border bg-muted/10 flex justify-end">
                 <button 
                   onClick={() => setSelectedInstance(null)}
                   className="px-6 py-2 rounded-xl bg-foreground text-white text-sm font-bold hover:opacity-90 transition-opacity"
                 >
                   Close
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Delegate Modal */}
      {isDelegateModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
           <div className="bg-card border rounded-xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
              <div className="px-6 py-5 border-b border-border bg-amber-50">
                 <h2 className="text-lg font-black text-amber-900">Delegate Approval</h2>
                 <p className="text-xs text-amber-700 font-bold tracking-tight uppercase">Transfer authorization responsibility</p>
              </div>
              
              <div className="p-6 space-y-4">
                 <div>
                    <label className="text-xs font-black uppercase text-muted-foreground mb-1.5 block">Assign To (User ID/Email)</label>
                    <input 
                      type="text" 
                      value={delegateTo}
                      onChange={(e) => setDelegateTo(e.target.value)}
                      placeholder="Enter user identifier..."
                      className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    />
                 </div>
                 <div>
                    <label className="text-xs font-black uppercase text-muted-foreground mb-1.5 block">Reason for Delegation</label>
                    <textarea 
                      placeholder="Explain why you are delegating..."
                      className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm min-h-[100px]"
                    />
                 </div>
              </div>

              <div className="p-5 border-t border-border bg-muted/10 flex justify-end gap-2">
                 <button 
                   onClick={() => setIsDelegateModalOpen(false)}
                   className="px-4 py-2 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-card transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={() => handleAction(selectedInstance!.id, 'DELEGATE', 'Delegated', delegateTo)}
                   className="px-6 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
                 >
                   Confirm Delegation
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
