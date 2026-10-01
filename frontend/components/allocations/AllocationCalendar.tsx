'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Allocation {
  id: string;
  user: { email: string };
  project: { name: string };
  startDate: string;
  endDate: string;
}

export default function AllocationCalendar() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/allocations').then(res => {
      setAllocations(res.data);
      setLoading(false);
    });
  }, []);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = 2026;

  if (loading) return <div className="p-8">Loading allocations...</div>;

  // Group by user
  const userAllocations: Record<string, Allocation[]> = {};
  allocations.forEach(a => {
    if (!userAllocations[a.user.email]) userAllocations[a.user.email] = [];
    userAllocations[a.user.email].push(a);
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Resource Allocations</h1>
          <p className="text-muted-foreground mt-1">Calendar View - {currentYear}</p>
        </div>
        <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold hover:opacity-90 transition">
          Add Allocation
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-xl overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Header */}
          <div className="grid grid-cols-13 border-b border-border bg-muted">
            <div className="col-span-1 p-4 font-bold text-muted-foreground text-xs uppercase tracking-widest border-r border-border">User</div>
            {months.map(m => (
              <div key={m} className="p-4 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest border-r border-border last:border-0">
                {m}
              </div>
            ))}
          </div>

          {/* Rows */}
          {Object.entries(userAllocations).map(([email, userAllocs]) => (
            <div key={email} className="grid grid-cols-13 border-b border-border relative group min-h-[80px]">
              <div className="col-span-1 p-4 border-r border-border flex items-center">
                <div>
                  <div className="text-sm font-bold text-foreground truncate w-32">{email.split('@')[0]}</div>
                  <div className="text-xs text-muted-foreground font-medium">{userAllocs.length} allocation{userAllocs.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              
              <div className="col-span-12 relative p-4">
                {userAllocs.map(a => {
                  const start = new Date(a.startDate);
                  const end = new Date(a.endDate);
                  
                  // Calculate position (very simplified)
                  const startPercent = (start.getMonth() / 12) * 100;
                  const durationPercent = ((end.getMonth() - start.getMonth() + 1) / 12) * 100;

                  return (
                    <div 
                      key={a.id}
                      className="absolute h-10 bg-blue-500/10 border-l-4 border-blue-500 rounded-md p-2 flex items-center justify-between group/bar hover:bg-blue-500/20 transition cursor-pointer"
                      style={{ 
                        left: `${startPercent}%`, 
                        width: `${durationPercent}%`,
                        top: '20px'
                      }}
                    >
                      <div className="truncate">
                        <span className="text-xs font-black text-blue-700 uppercase tracking-tighter">{a.project.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
