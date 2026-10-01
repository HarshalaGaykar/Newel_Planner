'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Target, 
  Zap, 
  TrendingDown, 
  ShieldAlert, 
  Users, 
  LayoutDashboard,
  ArrowUpRight
} from 'lucide-react';
import { advancedAnalyticsApi } from '@/lib/advanced-analytics-api';

// Mock Portfolio Data
const DEPARTMENT_PERFORMANCE = [
  { name: 'Engineering', profit: '₹1,20,000', margin: '32%', health: 'EXCELLENT' },
  { name: 'Product Management', profit: '₹45,000', margin: '28%', health: 'STABLE' },
  { name: 'Quality Assurance', profit: '₹38,000', margin: '22%', health: 'WARNING' },
  { name: 'Design', profit: '₹22,000', margin: '15%', health: 'CRITICAL' },
];

export default function PortfolioPage() {
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    advancedAnalyticsApi.getAnomalies().then(setAnomalies).catch(console.error);
  }, []);

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      {/* Executive Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest mb-2">
            <LayoutDashboard size={16} />
            Governance Console
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Executive Portfolio</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Real-time organizational P&L, billability heatmaps, and AI-driven risk intelligence.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs font-bold text-muted-foreground uppercase">Current Org Profit</p>
            <p className="text-2xl font-black text-emerald-600">₹2,25,480</p>
          </div>
          <div className="h-10 w-[1px] bg-border self-center" />
          <div className="text-right">
            <p className="text-xs font-bold text-muted-foreground uppercase">Target Efficiency</p>
            <p className="text-2xl font-black text-blue-600">88.5%</p>
          </div>
        </div>
      </div>

      {/* Primary Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Departmental P&L */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border-2 border-border/40 rounded-2xl p-6 shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <BarChart3 size={180} />
            </div>
            <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
              <Target size={22} className="text-primary" />
              Departmental Profitability & Health
            </h2>
            <div className="space-y-4">
              {DEPARTMENT_PERFORMANCE.map((dept) => (
                <div key={dept.name} className="flex items-center gap-6 p-4 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{dept.name}</h3>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs font-medium text-muted-foreground">Profit: <span className="text-foreground font-bold">{dept.profit}</span></span>
                      <span className="text-xs font-medium text-muted-foreground">Margin: <span className="text-foreground font-bold">{dept.margin}</span></span>
                    </div>
                  </div>
                  <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: dept.margin }} />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-black tracking-tighter ${
                    dept.health === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-700' :
                    dept.health === 'STABLE' ? 'bg-blue-100 text-blue-700' :
                    dept.health === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {dept.health}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Org Billability Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <MetricBox title="Global Billability" value="78.2%" trend="+4.1%" icon={<Users className="text-blue-500" />} />
             <MetricBox title="Bench Ratio" value="12.5%" trend="-2.0%" icon={<TrendingDown className="text-emerald-500" />} />
          </div>
        </div>

        {/* Right: AI Anomaly Feed */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden h-full">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Zap size={22} className="text-amber-400" />
              AI Intelligence Feed
            </h2>
            <div className="space-y-4">
              {anomalies.length === 0 ? (
                <div className="p-8 text-center text-white/20 border border-white/5 rounded-xl">
                   <p className="text-xs font-black uppercase tracking-widest">No active anomalies</p>
                </div>
              ) : anomalies.slice(0, 4).map((anomaly, i) => (
                <div key={i} className="p-4 bg-card/5 border border-white/10 rounded-xl hover:bg-card/10 transition-colors group cursor-help">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded tracking-tighter ${
                      anomaly.severity === 'HIGH' ? 'bg-amber-500 text-black' : 'bg-blue-500 text-white'
                    }`}>
                      {anomaly.severity}
                    </span>
                    <ShieldAlert size={16} className="text-white/40" />
                  </div>
                  <p className="text-sm font-medium text-white/90 leading-tight">{anomaly.description}</p>
                  <Link href="/advanced-analytics" className="mt-3 flex items-center gap-1 text-[10px] text-white/40 group-hover:text-amber-400 transition-colors uppercase font-black tracking-widest">
                    Investigate <ArrowUpRight size={10} />
                  </Link>
                </div>
              ))}
            </div>
            <Link href="/advanced-analytics" className="block">
              <button className="w-full mt-8 py-3 bg-card/10 hover:bg-card/20 border border-white/10 rounded-xl text-xs font-bold transition-all uppercase tracking-widest">
                View Unified AI Dashboard
              </button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

function MetricBox({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: React.ReactNode }) {
  return (
    <div className="bg-card border-2 border-border/40 rounded-2xl p-6 hover:border-primary/40 transition-colors group">
      <div className="flex justify-between items-center mb-4">
        <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 transition-colors">{icon}</div>
        <span className={`text-xs font-bold ${trend.startsWith('+') ? 'text-emerald-600' : 'text-emerald-600'}`}>
          {trend}
        </span>
      </div>
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
      <h3 className="text-3xl font-black mt-1 tracking-tight">{value}</h3>
    </div>
  );
}
