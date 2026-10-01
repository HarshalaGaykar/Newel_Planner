import TimesheetReport from '@/components/reports/TimesheetReport';
import { FileSpreadsheet } from 'lucide-react';

export default function TimesheetReportPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Timesheet & Effort Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Operational intelligence & logging compliance.</p>
        </div>
      </div>
      <TimesheetReport />
    </div>
  );
}
