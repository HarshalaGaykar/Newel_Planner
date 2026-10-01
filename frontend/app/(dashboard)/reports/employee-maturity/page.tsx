import EmployeeMaturityReport from '@/components/reports/EmployeeMaturityReport';
import { GaugeCircle } from 'lucide-react';

export default function EmployeeMaturityReportPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GaugeCircle size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Employee Maturity Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Month-wise maturity trends across departments, roles &amp; projects.</p>
        </div>
      </div>
      <EmployeeMaturityReport />
    </div>
  );
}
