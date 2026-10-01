'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Leave {
  id: string;
  user: { email: string };
  startDate: string;
  endDate: string;
  type: string;
  status: string;
}

export default function LeaveApprovals() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.get('/leaves');
      setLeaves(res.data.filter((l: Leave) => l.status === 'PENDING'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.patch(`/leaves/${id}/${action}`);
      setLeaves(leaves.filter(l => l.id !== id));
      alert(`Leave ${action}d successfully`);
    } catch (err) {
      alert('Error processing leave');
    }
  };

  if (loading) return <div className="p-8">Loading applications...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Pending Approvals</h1>

      {leaves.length === 0 ? (
        <div className="bg-card p-12 text-center rounded-2xl border border-border shadow-sm">
          <p className="text-muted-foreground font-medium text-lg">No pending leave applications found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {leaves.map(leave => (
            <div key={leave.id} className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                  {leave.user.email[0].toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-foreground">{leave.user.email}</h4>
                  <p className="text-xs text-muted-foreground">{leave.type} Leave</p>
                </div>
              </div>

              <div className="flex flex-col md:items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Duration</span>
                <span className="text-sm font-bold">
                  {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleAction(leave.id, 'reject')}
                  className="px-6 py-2 rounded-lg border-2 border-border text-sm font-bold text-muted-foreground hover:bg-muted transition"
                >
                  Reject
                </button>
                <button 
                  onClick={() => handleAction(leave.id, 'approve')}
                  className="px-6 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition shadow-lg shadow-green-100"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
