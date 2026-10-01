const fs = require('fs');

let content = fs.readFileSync('frontend/app/(dashboard)/timesheets/[id]/page.tsx', 'utf8');

// 1. Imports
content = content.replace(
  `import {\n  Clock, Plus, Trash2, ArrowLeft, Send, AlertCircle,\n  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,\n} from 'lucide-react';`,
  `import {\n  Clock, Plus, Trash2, ArrowLeft, Send, AlertCircle, Edit2,\n  ChevronDown, ChevronRight,\n} from 'lucide-react';\nimport { toast } from 'sonner';\nimport TimesheetEntryEditDialog from '@/components/timesheets/TimesheetEntryEditDialog';`
);

// Remove PaginationState and getPaginationRowModel
content = content.replace(
  `import {\n  type ColumnDef, type PaginationState,\n  flexRender, getCoreRowModel, getPaginationRowModel, useReactTable,\n} from '@tanstack/react-table';`,
  `import {\n  type ColumnDef,\n  flexRender, getCoreRowModel, useReactTable,\n} from '@tanstack/react-table';`
);

// 2. buildEntryColumns
content = content.replace(
  `function buildEntryColumns(\n  isEditable: boolean,\n  onDelete: (id: string) => void,\n): ColumnDef<TimesheetEntry>[] {`,
  `function buildEntryColumns(\n  isEditable: boolean,\n  onEdit: (entry: TimesheetEntry) => void,\n  onDelete: (id: string) => void,\n): ColumnDef<TimesheetEntry>[] {`
);

content = content.replace(
  `      cell: ({ row }) =>\n        isEditable ? (\n          <button\n            onClick={() => onDelete(row.original.id)}\n            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"\n            title="Delete Entry"\n          >\n            <Trash2 size={18} />\n          </button>\n        ) : null,`,
  `      cell: ({ row }) =>\n        isEditable ? (\n          <div className="flex gap-2">\n            <button\n              onClick={() => onEdit(row.original)}\n              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"\n              title="Edit Entry"\n            >\n              <Edit2 size={18} />\n            </button>\n            <button\n              onClick={() => onDelete(row.original.id)}\n              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"\n              title="Delete Entry"\n            >\n              <Trash2 size={18} />\n            </button>\n          </div>\n        ) : null,`
);

// 3. Form state & prefill
content = content.replace(
  `const [entryDate, setEntryDate] = useState('');\n  const [entryHoursPart, setEntryHoursPart] = useState(8);`,
  `const [entryDate, setEntryDate] = useState('');\n  const [entryHoursPart, setEntryHoursPart] = useState(0);`
);

content = content.replace(
  `  // Pagination\n  const [entryPagination, setEntryPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });`,
  `  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);`
);

content = content.replace(
  `      const startStr = tsData?.startDate ? new Date(tsData.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];\n      setEntryDate(startStr);`,
  `      const todayStr = new Date().toISOString().split('T')[0];\n      const startStr = tsData?.startDate ? new Date(tsData.startDate).toISOString().split('T')[0] : todayStr;\n      const endStr = tsData?.endDate ? new Date(tsData.endDate).toISOString().split('T')[0] : todayStr;\n      const defaultDate = (todayStr >= startStr && todayStr <= endStr) ? todayStr : startStr;\n      setEntryDate(defaultDate);`
);

content = content.replace(
  `    if (entryHoursPart === 0 && entryMinutesPart === 0) {\n      setError('Duration must be greater than 0');\n      return;\n    }`,
  `    if (entryHoursPart === 0 && entryMinutesPart === 0) {\n      toast.error('Duration must be greater than 0h 0m');\n      return;\n    }`
);

content = content.replace(
  `      setEntryHoursPart(8);`,
  `      setEntryHoursPart(0);`
);

content = content.replace(
  `  const entryColumns = useMemo(\n    () => buildEntryColumns(isEditable, handleDeleteEntry),\n    [isEditable, handleDeleteEntry],\n  );`,
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

content = content.replace(
  `  const entryTable = useReactTable({\n    data: sortedEntries,\n    columns: entryColumns,\n    getCoreRowModel: getCoreRowModel(),\n    getPaginationRowModel: getPaginationRowModel(),\n    onPaginationChange: setEntryPagination,\n    state: { pagination: entryPagination },\n  });`,
  newTableCode
);

// 5. Remove page rows calculation
content = content.replace(
  `  const pageRows = entryTable.getRowModel().rows;\n  const totalRowCount = sortedEntries.length;\n  const { pageIndex, pageSize } = entryPagination;\n  const pageStart = totalRowCount === 0 ? 0 : pageIndex * pageSize + 1;\n  const pageEnd = Math.min((pageIndex + 1) * pageSize, totalRowCount);`,
  `  const totalRowCount = sortedEntries.length;`
);

// 6. Replace Render Logged Entries
const oldLoggedEntries = `<div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b flex flex-col gap-2 sm:flex-row sm:items-center bg-muted/10">
          <h2 className="font-bold">Logged Entries</h2>
          {isEditable && (timesheet.entries?.length || 0) > 0 && (
            <button onClick={() => setConfirmSubmitOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm sm:ml-auto">
              <Send size={16} /> Submit for Approval
            </button>
          )}
        </div>

        <Table>
          <TableHeader>
            {entryTable.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="bg-muted/30 border-b border-muted hover:bg-muted/30">
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'px-3 sm:px-6 py-3 sm:py-4 font-medium text-muted-foreground whitespace-nowrap',
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
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Clock size={48} className="mb-4 opacity-20" />
                    <p>No time logged for this week yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, index, rows) => {
                const curDate = row.original.date.split('T')[0];
                const prevDate = index > 0 ? rows[index - 1].original.date.split('T')[0] : null;
                const nextDate = index < rows.length - 1 ? rows[index + 1].original.date.split('T')[0] : null;
                const isFirstInDay = curDate !== prevDate;
                const isLastInDay = curDate !== nextDate;
                const dayTotal = rows
                  .filter(r => r.original.date.split('T')[0] === curDate)
                  .reduce((s, r) => s + r.original.hours, 0);
                return (
                  <React.Fragment key={row.id}>
                    {isFirstInDay && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40 border-t border-muted">
                        <TableCell colSpan={6} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                          {formatDayHeader(curDate)}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="hover:bg-muted/10 transition-colors border-t border-muted/30">
                      {row.getVisibleCells().map(cell => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            'px-3 sm:px-6 py-3 sm:py-4',
                            cell.column.id === 'activity' && 'hidden md:table-cell',
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isLastInDay && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={4} />
                        <TableCell colSpan={2} className="px-3 sm:px-6 py-2 text-right text-xs font-black text-primary tracking-wide">
                          Daily total: {formatHours(dayTotal)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination bar — only shown when there is data */}
        {totalRowCount > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t bg-muted/5">
            <div className="flex items-center gap-2">
              <Label htmlFor={\`\${paginationId}-rpp\`} className="text-xs text-muted-foreground whitespace-nowrap">
                Rows per page
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={v => setEntryPagination({ pageIndex: 0, pageSize: Number(v) })}
              >
                <SelectTrigger id={\`\${paginationId}-rpp\`} className="h-8 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 25, 50].map(n => (
                    <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-xs text-muted-foreground text-center sm:text-left">
              {pageStart}–{pageEnd} of {totalRowCount} entries
            </span>

            <Pagination className="w-auto justify-end">
              <PaginationContent className="gap-1">
                <PaginationItem>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => entryTable.firstPage()} disabled={!entryTable.getCanPreviousPage()}>
                    <ChevronFirst size={14} />
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => entryTable.previousPage()} disabled={!entryTable.getCanPreviousPage()}>
                    <ChevronLeft size={14} />
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => entryTable.nextPage()} disabled={!entryTable.getCanNextPage()}>
                    <ChevronRight size={14} />
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => entryTable.lastPage()} disabled={!entryTable.getCanNextPage()}>
                    <ChevronLast size={14} />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}`;

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

content = content.replace(oldLoggedEntries, newLoggedEntries);

// 7. Add Dialog footer and EditDialog
const oldFooter = `            <button
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
    </div>
  );
}`;

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

content = content.replace(oldFooter, newFooter);

fs.writeFileSync('frontend/app/(dashboard)/timesheets/[id]/page.tsx', content);
