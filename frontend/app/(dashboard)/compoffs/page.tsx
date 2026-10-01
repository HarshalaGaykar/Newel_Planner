'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { operationsApi, CompOff } from '@/lib/operations-api';
import { useAuthStore } from '@/lib/store/auth';
import {
  Coffee, Plus, AlertCircle, CheckCircle, Clock,
  Trash2, CheckSquare, Loader2, Calendar,
  History, Filter, Search, MoreHorizontal, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ApiError = {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
};

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as ApiError).response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

export default function CompOffsPage() {
  const { user } = useAuthStore();
  const [compOffs, setCompOffs] = useState<CompOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompOff, setNewCompOff] = useState({ date: '', hoursWorked: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userId = user?.id;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await operationsApi.getCompOffs();
      setCompOffs(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load comp-off data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [userId, fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompOff.date || !newCompOff.hoursWorked) return;
    try {
      setIsSubmitting(true);
      await operationsApi.createCompOff({
        userId: user!.id,
        date: new Date(newCompOff.date).toISOString(),
        hoursWorked: parseFloat(newCompOff.hoursWorked),
      });
      setIsModalOpen(false);
      setNewCompOff({ date: '', hoursWorked: '' });
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create comp-off request'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await operationsApi.approveCompOff(id);
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to approve comp-off'));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await operationsApi.rejectCompOff(id);
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reject comp-off'));
    }
  };

  const handleUtilise = async (id: string) => {
    try {
      await operationsApi.utiliseCompOff(id);
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to mark as utilised'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return;
    try {
      await operationsApi.deleteCompOff(id);
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete comp-off'));
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      case 'UTILISED': return 'bg-blue-100 text-blue-700';
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      default: return 'bg-muted text-foreground';
    }
  };

  const ownCompOffs = compOffs.filter(c => c.userId === user?.id);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary/40" />
        <p className="text-xs text-muted-foreground">Loading comp-off data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Compensatory Off</h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Coffee size={12} /> Earn &amp; utilise extra hours
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus size={13} />
          Request Comp-Off
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-red-600 text-xs">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Available Balance', value: ownCompOffs.filter(c => c.status === 'APPROVED').reduce((acc, curr) => acc + curr.extraHours, 0).toFixed(1) + 'h', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Requests', value: ownCompOffs.filter(c => c.status === 'PENDING').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Total Utilised', value: ownCompOffs.filter(c => c.status === 'UTILISED').reduce((acc, curr) => acc + curr.extraHours, 0).toFixed(1) + 'h', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-card p-3 rounded-lg border border-border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{stat.label}</p>
              <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center`}>
              <stat.icon size={16} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-card rounded-lg border border-border shadow overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
            <input
              type="text"
              placeholder="Filter by resource or date..."
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button className="btn-secondary btn-sm flex items-center gap-1.5">
            <Filter size={12} /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resource</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Hours</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Earned</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Status</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {compOffs.map((c) => {
                const canApproveOrReject = c.status === 'PENDING' && c.userId !== user?.id;
                const canDelete = c.status === 'PENDING' && (c.userId === user?.id || ['ADMIN', 'HR'].includes(user?.role || ''));
                const resourceName = [c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ') || c.user?.email || 'Unknown user';
                const resourceInitials = resourceName
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                <tr key={c.id} className="hover:bg-muted/30 transition group">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground uppercase">
                        {resourceInitials}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-foreground">{resourceName}</div>
                        <div className="text-xs text-muted-foreground">{c.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-foreground">
                      <Calendar size={12} className="text-muted-foreground/60" />
                      {new Date(c.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs font-medium text-foreground bg-muted py-0.5 px-2 rounded">{c.hoursWorked}h</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 py-0.5 px-2 rounded">+{c.extraHours}h</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium uppercase', getStatusStyle(c.status))}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {canApproveOrReject && (
                        <button onClick={() => handleReject(c.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-600 hover:text-white transition-all" title="Reject">
                          <XCircle size={13} />
                        </button>
                      )}
                      {canApproveOrReject && (
                        <button onClick={() => handleApprove(c.id)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-all" title="Approve">
                          <CheckSquare size={13} />
                        </button>
                      )}
                      {c.status === 'APPROVED' && c.userId === user?.id && (
                        <button onClick={() => handleUtilise(c.id)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition-all" title="Mark Utilised">
                          <Coffee size={13} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-600 hover:text-white transition-all" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button className="p-1.5 bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-all">
                        <MoreHorizontal size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {compOffs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Coffee size={28} />
                      <p className="text-xs text-foreground">No compensatory records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Request Comp-Off</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Submit extra hours worked for credit</p>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="form-label">Date of Extra Work</label>
                <input
                  type="date"
                  required
                  value={newCompOff.date}
                  onChange={(e) => setNewCompOff({ ...newCompOff, date: e.target.value })}
                  className="field-input"
                />
              </div>

              <div>
                <label className="form-label">Total Hours Worked</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="e.g. 12"
                    value={newCompOff.hoursWorked}
                    onChange={(e) => setNewCompOff({ ...newCompOff, hoursWorked: e.target.value })}
                    className="field-input pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">hrs</span>
                </div>
                <p className="text-xs text-amber-500 mt-1">Only hours exceeding the standard 9h shift are eligible.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
