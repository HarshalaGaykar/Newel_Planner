'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';

interface LeaveBalance {
  type: string;
  balance: number;
}

export default function ApplyLeave() {
  const { user } = useAuthStore();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    type: 'ANNUAL',
  });

  useEffect(() => {
    if (user) {
      api.get(`/leaves/balances/${user.id}`).then(res => setBalances(res.data));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await api.post('/leaves', { ...form, userId: user.id });
      alert('Leave application submitted successfully!');
      setForm({ startDate: '', endDate: '', type: 'ANNUAL' });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error applying for leave');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Leave Management</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        {['ANNUAL', 'SICK', 'CASUAL', 'COMP_OFF'].map(type => {
          const bal = balances.find(b => b.type === type)?.balance || 0;
          return (
            <div key={type} className="bg-card p-6 rounded-xl border border-border shadow-sm">
              <h4 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                {type.replace('_', ' ')} Balance
              </h4>
              <div className="text-2xl font-black mt-2">{bal.toFixed(2)} days</div>
            </div>
          );
        })}
      </div>

      <div className="bg-card p-8 rounded-2xl border border-border shadow-lg">
        <h3 className="text-xl font-bold mb-6">Apply for Leave</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">Start Date</label>
              <input 
                type="date" 
                required
                value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
                className="w-full p-3 rounded-lg border border-border focus:border-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">End Date</label>
              <input 
                type="date" 
                required
                value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full p-3 rounded-lg border border-border focus:border-blue-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-foreground mb-2">Leave Type</label>
            <select 
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full p-3 rounded-lg border border-border focus:border-blue-500 outline-none transition appearance-none bg-card"
            >
              <option value="ANNUAL">Annual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="COMP_OFF">Compensatory Off</option>
            </select>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Apply for Leave'}
          </button>
        </form>
      </div>
    </div>
  );
}
