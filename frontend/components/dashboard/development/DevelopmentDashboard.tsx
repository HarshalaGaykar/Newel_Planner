'use client';

import { Project } from '@/lib/projects-api';

export default function DevelopmentDashboard({ project }: { project: Project }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sprint Progress</h4>
          <div className="mt-1 text-lg font-black">75%</div>
          <div className="mt-1.5 w-full bg-muted rounded-full h-1.5">
            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '75%' }}></div>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Milestones</h4>
          <div className="mt-1 text-lg font-black">3 / 5</div>
          <p className="text-xs font-bold text-green-600 mt-1.5">2 completed this month</p>
        </div>
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Team Velocity</h4>
          <div className="mt-1 text-lg font-black">42 pts</div>
          <p className="text-xs font-bold text-blue-600 mt-1.5">↑ 12% from last sprint</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-3 text-muted-foreground">Sprint Board (Preview)</h3>
          <div className="space-y-2">
            {['Design System', 'API Integration', 'Auth Flow'].map((task, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                <span className="text-xs font-bold">{task}</span>
                <span className="text-xs font-black uppercase tracking-tighter px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-md">In Progress</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-3 text-muted-foreground">Milestone Timeline</h3>
          <div className="relative pl-6 border-l-2 border-border space-y-6">
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white"></div>
              <h4 className="text-xs font-bold">Beta Release</h4>
              <p className="text-xs font-bold text-muted-foreground mt-0.5">Target: May 15, 2026</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-muted-foreground/40 border-2 border-card"></div>
              <h4 className="text-xs font-bold">Final Audit</h4>
              <p className="text-xs font-bold text-muted-foreground mt-0.5">Target: June 01, 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
