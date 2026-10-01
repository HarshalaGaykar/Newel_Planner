'use client';

import StatCardsRow from './tl/StatCardsRow';
import TaskStatusDonuts from './tl/TaskStatusDonuts';
import TeamLeaveCalendar from './tl/TeamLeaveCalendar';
import TeamGanttPanel from './tl/TeamGanttPanel';
import MyDayCard from './tl/MyDayCard';

// Pure layout — every section below fetches its own data independently, so a
// slow/failed request in one (e.g. the Gantt) never blocks the others.
export default function TLDashboard() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-foreground tracking-tight uppercase">Team Overview</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <MyDayCard />
      </div>

      <StatCardsRow />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <TaskStatusDonuts />
        </div>
        <div className="xl:col-span-2">
          <TeamLeaveCalendar />
        </div>
      </div>

      <TeamGanttPanel />
    </div>
  );
}
