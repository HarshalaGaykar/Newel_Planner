'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Download, Filter, FileText, LayoutGrid, Calendar } from 'lucide-react';

export default function ReportingHub() {
  const [reportType, setReportType] = useState<'timesheets' | 'utilization' | 'project-summary'>('timesheets');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    projectId: '',
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(filters as any).toString();
      const res = await api.get(`/reports/${reportType}?${query}`);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const exportCSV = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => `"${val}"`).join(',')
    ).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportType}_report.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Intelligence Hub</h1>
          <p className="text-muted-foreground mt-1">Generate and export detailed operational reports.</p>
        </div>
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-2xl mb-8 w-fit">
        {[
          { id: 'timesheets', label: 'Timesheet Detail', icon: FileText },
          { id: 'utilization', label: 'Resource Utilization', icon: LayoutGrid },
          { id: 'project-summary', label: 'Project Summary', icon: Calendar },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition ${
              reportType === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm mb-8 flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Start Date</label>
          <input 
            type="date" 
            value={filters.startDate}
            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            className="p-2.5 rounded-lg border border-border text-sm font-bold outline-none focus:border-blue-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">End Date</label>
          <input 
            type="date" 
            value={filters.endDate}
            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            className="p-2.5 rounded-lg border border-border text-sm font-bold outline-none focus:border-blue-500 transition"
          />
        </div>
        <button 
          onClick={fetchReport}
          className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition"
        >
          Generate Report
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-muted-foreground font-bold">Compiling data...</div>
        ) : data.length === 0 ? (
          <div className="p-20 text-center text-muted-foreground font-bold">No data found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {Object.keys(data[0]).map(key => (
                    <th key={key} className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-border hover:bg-muted transition">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="p-4 text-sm font-medium text-foreground">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
