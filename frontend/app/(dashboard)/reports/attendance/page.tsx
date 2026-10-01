import AttendanceReport from '@/components/reports/AttendanceReport';
import { Clock } from 'lucide-react';

export default function AttendanceReportPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Attendance Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Clock-in compliance, overtime &amp; latecomer analysis.</p>
        </div>
      </div>
      <AttendanceReport />
    </div>
  );
}
