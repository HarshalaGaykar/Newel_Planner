'use client';

import { Project } from '@/lib/projects-api';

export default function MaintenanceDashboard({ project }: { project: Project }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Open Tickets</h4>
          <div className="mt-1 text-lg font-black text-red-600">12</div>
          <p className="text-xs font-bold text-muted-foreground mt-1.5">4 high priority</p>
        </div>
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">SLA Compliance</h4>
          <div className="mt-1 text-lg font-black text-green-600">99.8%</div>
          <p className="text-xs font-bold text-green-600 mt-1.5">Target: 98.0%</p>
        </div>
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Avg Resolution Time</h4>
          <div className="mt-1 text-lg font-black">4.2h</div>
          <p className="text-xs font-bold text-blue-600 mt-1.5">↓ 15% from last week</p>
        </div>
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Monthly Burn</h4>
          <div className="mt-1 text-lg font-black">₹12,450.00</div>
          <p className="text-xs font-bold text-muted-foreground mt-1.5">Budget: ₹15,000.00</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card p-4 rounded-xl shadow-sm border border-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Urgent Tickets</h3>
            <button className="text-blue-600 text-xs font-bold uppercase tracking-widest hover:underline">View Queue</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-bold">
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Issue</th>
                  <th className="pb-2">Priority</th>
                  <th className="pb-2">SLA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {[
                  { id: 'T-1024', title: 'Login service intermittent timeout', priority: 'High', sla: '01:24:00 left' },
                  { id: 'T-1025', title: 'Data mismatch in monthly report', priority: 'Medium', sla: '04:12:00 left' },
                  { id: 'T-1026', title: 'User permissions not updating', priority: 'High', sla: '00:45:00 left' },
                ].map((ticket) => (
                  <tr key={ticket.id} className="group hover:bg-muted transition">
                    <td className="py-3 font-bold text-muted-foreground">{ticket.id}</td>
                    <td className="py-3 font-medium">{ticket.title}</td>
                    <td className="py-3">
                      <span className={`px-1.5 py-0.5 rounded-md text-xs font-black uppercase tracking-tighter ${
                        ticket.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-xs font-bold text-blue-600">{ticket.sla}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-3 text-muted-foreground">Incident Distribution</h3>
          <div className="space-y-4">
            {[
              { label: 'Security', count: 2, color: 'bg-red-500' },
              { label: 'Performance', count: 5, color: 'bg-orange-500' },
              { label: 'UI/UX', count: 8, color: 'bg-blue-500' },
              { label: 'Database', count: 3, color: 'bg-purple-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold text-muted-foreground">{item.label}</span>
                  <span className="font-black text-foreground">{item.count}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className={`${item.color} h-1.5 rounded-full`} style={{ width: `${(item.count/18)*100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
