'use client';

import { useState } from 'react';
import { Users, Loader2, Play, Download, Search } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

export default function AvailabilityReport() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/resource-availability', { params: { startDate: date } });
      setData(res.data);
    } catch (err) {
      console.error('Failed to run availability report', err);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const response = await api.get('/reports/export/resource-availability', {
        params: { startDate: date },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `resource-availability-${date}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  const filteredData = data.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="p-8 border-b border-border bg-muted/5">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight uppercase">Resource Availability</h3>
            <p className="text-sm text-muted-foreground font-medium">Real-time view of workforce capacity and allocations.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Reference Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Run Report
            </button>
            <button
              onClick={exportExcel}
              disabled={exporting || data.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-border bg-background text-sm font-black uppercase tracking-widest hover:bg-secondary transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {data.length > 0 ? (
          <div className="space-y-6">
            <div className="relative w-full max-w-sm group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
              <input 
                type="text"
                placeholder="Search by name, email or department..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-muted/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border shadow-inner bg-muted/5">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    {['Resource Name', 'Role', 'Department', 'Current Allocation', 'Status'].map(h => (
                      <th key={h} className="px-6 py-4 font-black text-muted-foreground text-[10px] uppercase tracking-[0.2em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredData.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{r.name}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{r.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{r.role}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs font-bold text-muted-foreground">{r.department || '—'}</span>
                      </td>
                      <td className="px-6 py-5 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full transition-all duration-1000", r.allocatedPct > 100 ? "bg-rose-500" : "bg-primary")} 
                              style={{ width: `${Math.min(r.allocatedPct, 100)}%` }} 
                            />
                          </div>
                          <span className="font-black text-xs tabular-nums">{r.allocatedPct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={cn(
                          'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm',
                          r.availablePct > 50 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                          r.availablePct > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                          'bg-muted text-muted-foreground border-border'
                        )}>
                          {r.availablePct}% Free
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center flex flex-col items-center justify-center opacity-40">
            <Users size={48} className="mb-4 text-muted-foreground" />
            <h4 className="text-lg font-black uppercase tracking-widest">No Data Generated</h4>
            <p className="text-sm font-medium mt-1">Select a reference date and run the report to see availability analytics.</p>
          </div>
        )}
      </div>
    </div>
  );
}
