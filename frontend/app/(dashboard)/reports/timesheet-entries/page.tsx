'use client';

import { useState } from 'react';
import TimesheetEntriesReport from '@/components/reports/TimesheetEntriesReport';
import MonthlyEffortsReport from '@/components/reports/MonthlyEffortsReport';
import { CalendarClock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export default function MonthlyTimesheetReportPage() {
  const [monthlyReportOpen, setMonthlyReportOpen] = useState(false);
  const [showEntryFilters, setShowEntryFilters] = useState(false);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Monthly Timesheet Report</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every logged entry, dynamically filterable, with a per-project effort summary below.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={showEntryFilters ? 'Hide filters' : 'Show filters'}
            aria-pressed={showEntryFilters}
            onClick={() => setShowEntryFilters((v) => !v)}
          >
            <Filter className="w-4 h-4" />
          </Button>

          <Dialog open={monthlyReportOpen} onOpenChange={setMonthlyReportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">View Monthly Report</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Monthly Project Efforts</DialogTitle>
              </DialogHeader>
              <MonthlyEffortsReport />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Section 1 — every timesheet entry, fully dynamic filters */}
      <TimesheetEntriesReport showFilters={showEntryFilters} />
    </div>
  );
}
