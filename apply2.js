const fs = require('fs');

let content = fs.readFileSync('frontend/app/(dashboard)/timesheets/[id]/page.tsx', 'utf8');

const applyRegexReplace = (regex, replacement) => {
  if(regex.test(content)) {
    content = content.replace(regex, replacement);
  } else {
    console.error("Failed to match: " + regex);
  }
}

// 1. Imports
applyRegexReplace(
  /import \{\s*Clock, Plus, Trash2, ArrowLeft, Send, AlertCircle,\s*ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,\s*\} from 'lucide-react';/,
  `import {\n  Clock, Plus, Trash2, ArrowLeft, Send, AlertCircle, Edit2,\n  ChevronDown, ChevronRight,\n} from 'lucide-react';\nimport { toast } from 'sonner';\nimport TimesheetEntryEditDialog from '@/components/timesheets/TimesheetEntryEditDialog';`
);

applyRegexReplace(
  /import \{\s*type ColumnDef, type PaginationState,\s*flexRender, getCoreRowModel, getPaginationRowModel, useReactTable,\s*\} from '@tanstack\/react-table';/,
  `import {\n  type ColumnDef,\n  flexRender, getCoreRowModel, useReactTable,\n} from '@tanstack/react-table';`
);

// 2. buildEntryColumns
applyRegexReplace(
  /function buildEntryColumns\(\s*isEditable: boolean,\s*onDelete: \(id: string\) => void,\s*\): ColumnDef<TimesheetEntry>\[\] \{/,
  `function buildEntryColumns(\n  isEditable: boolean,\n  onEdit: (entry: TimesheetEntry) => void,\n  onDelete: (id: string) => void,\n): ColumnDef<TimesheetEntry>[] {`
);

applyRegexReplace(
  /cell: \(\{ row \}\) =>\s*isEditable \? \(\s*<button\s*onClick=\{[^}]*\}\s*className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"\s*title="Delete Entry"\s*>\s*<Trash2 size=\{18\} \/>\s*<\/button>\s*\) : null,/,
  `      cell: ({ row }) =>\n        isEditable ? (\n          <div className="flex gap-2">\n            <button\n              onClick={() => onEdit(row.original)}\n              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"\n              title="Edit Entry"\n            >\n              <Edit2 size={18} />\n            </button>\n            <button\n              onClick={() => onDelete(row.original.id)}\n              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"\n              title="Delete Entry"\n            >\n              <Trash2 size={18} />\n            </button>\n          </div>\n        ) : null,`
);

// 3. Form state & prefill
applyRegexReplace(
  /const \[entryDate, setEntryDate\] = useState\(''\);\s*const \[entryHoursPart, setEntryHoursPart\] = useState\(8\);/,
  `const [entryDate, setEntryDate] = useState('');\n  const [entryHoursPart, setEntryHoursPart] = useState(0);`
);

applyRegexReplace(
  /const \[entryPagination, setEntryPagination\] = useState<PaginationState>\(\{ pageIndex: 0, pageSize: 10 \}\);/,
  `const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);`
);

applyRegexReplace(
  /const startStr = tsData\?\.startDate \? new Date\(tsData\.startDate\)\.toISOString\(\)\.split\('T'\)\[0\] : new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];\s*setEntryDate\(startStr\);/,
  `      const todayStr = new Date().toISOString().split('T')[0];\n      const startStr = tsData?.startDate ? new Date(tsData.startDate).toISOString().split('T')[0] : todayStr;\n      const endStr = tsData?.endDate ? new Date(tsData.endDate).toISOString().split('T')[0] : todayStr;\n      const defaultDate = (todayStr >= startStr && todayStr <= endStr) ? todayStr : startStr;\n      setEntryDate(defaultDate);`
);

applyRegexReplace(
  /if \(entryHoursPart === 0 && entryMinutesPart === 0\) \{\s*setError\('Duration must be greater than 0'\);\s*return;\s*\}/,
  `    if (entryHoursPart === 0 && entryMinutesPart === 0) {\n      toast.error('Duration must be greater than 0h 0m');\n      return;\n    }`
);

applyRegexReplace(
  /setEntryHoursPart\(8\);/,
  `setEntryHoursPart(0);`
);

applyRegexReplace(
  /const entryColumns = useMemo\(\s*\(\) => buildEntryColumns\(isEditable, handleDeleteEntry\),\s*\[isEditable, handleDeleteEntry\],\s*\);/,
  `  const entryColumns = useMemo(\n    () => buildEntryColumns(isEditable, setEditingEntry, handleDeleteEntry),\n    [isEditable, handleDeleteEntry],\n  );`
);

// 4. useReactTable and grouping logic
const newTableCode = `  const entryTable = useReactTable({
    data: sortedEntries,
    columns: entryColumns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: { date: false } },
  });

  const entriesByDate = useMemo(() => {
    const groups: Record<string, typeof entryTable.getRowModel().rows> = {};
    for (const row of entryTable.getRowModel().rows) {
      const dateStr = row.original.date.split('T')[0];
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(row);
    }
    return groups;
  }, [entryTable.getRowModel().rows]);
  
  const sortedDates = useMemo(() => Object.keys(entriesByDate).sort(), [entriesByDate]);

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    if (sortedDates.length > 0 && Object.keys(expandedDays).length === 0) {
      const initial: Record<string, boolean> = {};
      sortedDates.forEach(d => initial[d] = true);
      setExpandedDays(initial);
    }
  }, [sortedDates, expandedDays]);

  const toggleDay = (date: string) => {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  };`;

applyRegexReplace(
  /const entryTable = useReactTable\(\{\s*data: sortedEntries,\s*columns: entryColumns,\s*getCoreRowModel: getCoreRowModel\(\),\s*getPaginationRowModel: getPaginationRowModel\(\),\s*onPaginationChange: setEntryPagination,\s*state: \{ pagination: entryPagination \},\s*\}\);/,
  newTableCode
);

// 5. Remove page rows calculation
applyRegexReplace(
  /const pageRows = entryTable\.getRowModel\(\)\.rows;\s*const totalRowCount = sortedEntries\.length;\s*const \{ pageIndex, pageSize \} = entryPagination;\s*const pageStart = totalRowCount === 0 \? 0 : pageIndex \* pageSize \+ 1;\s*const pageEnd = Math\.min\(\(pageIndex \+ 1\) \* pageSize, totalRowCount\);/,
  `const totalRowCount = sortedEntries.length;`
);

// 6. Replace Render Logged Entries
const newLoggedEntries = `<div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b flex flex-col gap-2 sm:flex-row sm:items-center bg-muted/10">
          <h2 className="font-bold">Logged Entries</h2>
          {isEditable && (timesheet.entries?.length || 0) > 0 && (
            <button onClick={() => setConfirmSubmitOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 sm:ml-auto">
              <Send size={16} /> Submit Timesheet
            </button>
          )}
        </div>

        {sortedDates.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Clock size={48} className="mb-4 opacity-20" />
              <p>No time logged for this week yet.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedDates.map((dateStr) => {
              const dayRows = entriesByDate[dateStr];
              const dayTotal = timesheet.dailyTotals?.[dateStr] ?? dayRows.reduce((s, r) => s + r.original.hours, 0);
              const isExpanded = expandedDays[dateStr] !== false; // defaults to true

              return (
                <div key={dateStr} className="bg-card">
                  <div 
                    className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => toggleDay(dateStr)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground flex items-center justify-center w-6 h-6 rounded-full hover:bg-muted/50 transition-colors">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider text-foreground">
                        {formatDayHeader(dateStr)}
                      </h3>
                    </div>
                    <div className="font-black text-primary text-sm sm:text-base">
                      {formatHours(dayTotal)}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="border-t bg-muted/5 px-2 sm:px-4 pb-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          {entryTable.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id} className="bg-transparent border-b hover:bg-transparent">
                              {headerGroup.headers.map(header => (
                                <TableHead
                                  key={header.id}
                                  className={cn(
                                    'px-3 sm:px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap',
                                    header.column.id === 'activity' && 'hidden md:table-cell',
                                  )}
                                >
                                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                              ))}
                            </TableRow>
                          ))}
                        </TableHeader>
                        <TableBody>
                          {dayRows.map((row) => (
                            <TableRow key={row.id} className="hover:bg-muted/20 transition-colors border-b/50">
                              {row.getVisibleCells().map(cell => (
                                <TableCell
                                  key={cell.id}
                                  className={cn(
                                    'px-3 sm:px-4 py-3',
                                    cell.column.id === 'activity' && 'hidden md:table-cell',
                                  )}
                                >
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>`;

applyRegexReplace(
  /<div className="bg-card border rounded-xl shadow-sm overflow-hidden">[\s\S]*?\{totalRowCount > 0 && \([\s\S]*?<\/div>\s*\)\}\s*<\/div>/,
  newLoggedEntries
);

// 7. Add Dialog footer and EditDialog
const newFooter = `            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Timesheet'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingEntry && (
        <TimesheetEntryEditDialog
          entry={editingEntry}
          timesheet={timesheet}
          projects={projects}
          taskTypeMasterTree={taskTypeMasterTree}
          canViewAll={['ADMIN', 'PM', 'TL'].includes(authUser?.role ?? '')}
          onOpenChange={(open) => { if (!open) setEditingEntry(null); }}
          onSaved={() => {
            setEditingEntry(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}`;

applyRegexReplace(
  /<button\s*type="button"\s*onClick=\{handleConfirmSubmit\}\s*disabled=\{submitting\}\s*className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"\s*>\s*\{submitting \? 'Submitting…' : 'Submit Timesheet'\}\s*<\/button>\s*<\/DialogFooter>\s*<\/DialogContent>\s*<\/Dialog>\s*<\/div>\s*\);\s*\}/,
  newFooter
);

fs.writeFileSync('frontend/app/(dashboard)/timesheets/[id]/page.tsx', content);
