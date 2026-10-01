import LeaveReport from '@/components/reports/LeaveReport';
import { CalendarRange } from 'lucide-react';

export default function LeaveReportPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarRange size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Leave Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Leave utilization, register &amp; carry-forward liability.</p>
        </div>
      </div>
      <LeaveReport />
    </div>
  );
}
