import UtilizationReport from '@/components/reports/UtilizationReport';
import { Users } from 'lucide-react';

export default function UtilizationReportsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Capacity Intelligence</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Workforce utilization & performance.</p>
        </div>
      </div>
      <UtilizationReport />
    </div>
  );
}
