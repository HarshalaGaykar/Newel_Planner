'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { API_BASE_URL } from '@/lib/api-url';
import { 
  Briefcase, Download, Search, 
  Layers, CheckCircle2, TrendingUp,
  ArrowUpRight, ListFilter
} from 'lucide-react';

export default function ProjectReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  
  const [filters, setFilters] = useState({
    projectId: ''
  });

  useEffect(() => {
    api.get('/projects')
      .then(res => setProjects(res.data))
      .catch(err => console.error('Error fetching projects:', err));
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
      );
      const query = new URLSearchParams(activeFilters as any).toString();
      const res = await api.get(`/reports/project-summary?${query}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching project report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const handleExport = () => {
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = new URLSearchParams(activeFilters as any).toString();
    window.open(`${API_BASE_URL}/reports/export/project-summary?${query}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Bar */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-lg shadow-sm/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">Project Portfolio Intelligence</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Cross-project performance & revenue audit</p>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition shadow-lg shadow-sm"
          >
            <Download className="w-3 h-3" />
            Export Portfolio CSV
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="w-full md:w-64 space-y-1">
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Filter by Project</label>
            <div className="relative">
              <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <select 
                value={filters.projectId}
                onChange={(e) => setFilters({...filters, projectId: e.target.value})}
                className="w-full pl-8 pr-8 py-1.5 text-xs font-bold bg-muted border-none rounded-lg focus:ring-1 focus:ring-ring appearance-none transition"
              >
                <option value="">All active projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ListFilter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-muted-foreground/50 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Portfolio Value', value: `₹${data.reduce((s, i) => s + i.totalRevenue, 0).toLocaleString()}` },
            { label: 'Project Count', value: data.length },
            { label: 'Total Tasks', value: data.reduce((s, i) => s + i.taskCount, 0) },
            { label: 'Avg. Revenue / Project', value: `₹${Math.round(data.reduce((s, i) => s + i.totalRevenue, 0) / (data.length || 1)).toLocaleString()}` }
          ].map((stat, i) => (
            <div key={stat.label} className="bg-card p-4 rounded-xl border border-border shadow-md">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <h3 className="text-sm font-black text-foreground">{stat.value}</h3>
            </div>
          ))}
        </div>
      )}

      {/* Report Table */}
      <div className="bg-card rounded-xl border border-border shadow-md/20 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Aggregating Portfolio Data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest">Project Identity</th>
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest">Classification</th>
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest text-center">Activity Metrics</th>
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest text-right">Revenue Yield</th>
                  <th className="px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50 transition group cursor-pointer">
                    <td className="px-6 py-3">
                      <div className="text-xs font-black text-foreground group-hover:text-blue-600 transition">{item.name}</div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter mt-0.5">ID: {item.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded">
                        <Layers className="w-2 h-2 text-muted-foreground" />
                        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">{item.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-3">
                        <div className="text-center">
                          <div className="text-xs font-black text-foreground">{item.taskCount}</div>
                          <div className="text-xs font-bold text-muted-foreground uppercase">Tasks</div>
                        </div>
                        <div className="w-px h-4 bg-muted"></div>
                        <div className="text-center">
                          <div className="text-xs font-black text-foreground">{item.ticketCount}</div>
                          <div className="text-xs font-bold text-muted-foreground uppercase">Tickets</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="text-xs font-black text-foreground">₹{item.totalRevenue.toLocaleString()}</div>
                      <div className="text-xs font-bold text-green-600 uppercase flex items-center justify-end gap-0.5 mt-0.5">
                        <TrendingUp className="w-2 h-2" /> Invoiced
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-[0.1em] ${
                        item.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 
                        item.status === 'COMPLETED' ? 'bg-blue-100 text-blue-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">No project data found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
