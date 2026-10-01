import ProjectReport from '@/components/reports/ProjectReport';
import { BarChart3 } from 'lucide-react';

export default function ProjectReportsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={15} className="text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Strategic Insights</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Project portfolio analysis.</p>
        </div>
      </div>
      <ProjectReport />
    </div>
  );
}
