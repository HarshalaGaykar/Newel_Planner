import AvailabilityReport from '@/components/reports/AvailabilityReport';
import { Activity } from 'lucide-react';

export default function ResourceAvailabilityReportPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Workforce Capacity & Availability</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Resource availability analytics.</p>
        </div>
      </div>
      <AvailabilityReport />
    </div>
  );
}
