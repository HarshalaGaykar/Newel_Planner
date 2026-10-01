import NonComplianceReport from '@/components/reports/NonComplianceReport';
import { ShieldAlert } from 'lucide-react';

export default function NonComplianceReportPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Attendance Compliance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Identify resources with missing check-ins, leaves, and timesheets.</p>
        </div>
      </div>
      <NonComplianceReport />
    </div>
  );
}
