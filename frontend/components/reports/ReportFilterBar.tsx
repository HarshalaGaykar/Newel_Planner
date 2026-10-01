'use client';

import { ReactNode } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Tailwind needs the full class name statically present in source to
// generate it — can't interpolate `md:grid-cols-${n}`.
const GRID_COLS_CLASS: Record<2 | 3 | 4, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

interface ReportFilterBarProps {
  onApply: () => void;
  onClear: () => void;
  // Disables both actions while a fetch triggered by the last click is in
  // flight, so a report can't be re-applied out of order with its own response.
  loading?: boolean;
  applyLabel?: string;
  clearLabel?: string;
  // Number of filter fields per row on md+ screens — match the field count
  // passed as children so the grid doesn't leave a dangling empty column.
  columns?: 2 | 3 | 4;
  // Each report owns its own filter fields/state (dates, project, resource,
  // status, ...) and renders them here; this component only standardizes the
  // grid layout and the Apply/Clear actions so the pattern can be reused
  // across other report pages.
  children: ReactNode;
}

export function ReportFilterBar({
  onApply,
  onClear,
  loading = false,
  applyLabel = 'Apply Filter',
  clearLabel = 'Clear',
  columns = 4,
  children,
}: ReportFilterBarProps) {
  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 ${GRID_COLS_CLASS[columns]} gap-4`}>{children}</div>
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          disabled={loading}
          className="gap-2 text-xs font-black uppercase tracking-widest rounded-xl"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {clearLabel}
        </Button>
        <Button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="gap-2 text-xs font-black uppercase tracking-widest rounded-xl"
        >
          <Filter className="w-3.5 h-3.5" />
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}
