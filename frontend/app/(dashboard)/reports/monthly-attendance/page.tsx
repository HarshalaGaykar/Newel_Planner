import MonthlyAttendanceReport from '@/components/reports/MonthlyAttendanceReport';
import { CalendarCheck } from 'lucide-react';

export default function MonthlyAttendanceReportPage() {
  return (
    <div className="space-y-10">
      <div className="flex items-center gap-2">
        <CalendarCheck size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Monthly Attendance Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily check-in register for every employee, one row per calendar day of the month.
          </p>
        </div>
      </div>

      <MonthlyAttendanceReport />
    </div>
  );
}
