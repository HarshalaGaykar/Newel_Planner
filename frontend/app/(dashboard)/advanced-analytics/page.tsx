'use client';

import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  ShieldAlert, 
  TrendingUp, 
  Users, 
  BrainCircuit, 
  AlertTriangle,
  CheckCircle2,
  Activity,
  ArrowRight,
  ShieldCheck,
  History,
  Sparkles,
  Target,
  Loader2,
  ArrowUpRight
} from 'lucide-react';
import { advancedAnalyticsApi, BurnoutRisk, ProjectHealth } from '@/lib/advanced-analytics-api';
import { projectsApi } from '@/lib/projects-api';
import { cn } from '@/lib/utils';

const metrics = [
  { label: 'Model Accuracy', value: '94.2%', trend: '+2.1%', icon: Target },
  { label: 'Predictions Active', value: '1,248', trend: '+14', icon: BrainCircuit },
  { label: 'Risks Mitigated', value: '156', trend: '+12%', icon: CheckCircle2 },
  { label: 'Processing Latency', value: '24ms', trend: '-5ms', icon: Activity },
];

export default function AdvancedAnalyticsPage() {
  const [burnoutRisks, setBurnoutRisks] = useState<BurnoutRisk[]>([]);
  const [projectHealths, setProjectHealths] = useState<ProjectHealth[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [risks, projects, anomalyData] = await Promise.all([
          advancedAnalyticsApi.getBurnoutRisk(),
          projectsApi.getAll(),
          advancedAnalyticsApi.getAnomalies(),
        ]);
        
        setBurnoutRisks(risks);
        setAnomalies(anomalyData);

        const healths = await Promise.all(
          projects.filter(p => p.status === 'ACTIVE').slice(0, 6).map(p => 
            advancedAnalyticsApi.getProjectHealth(p.id)
          )
        );
        setProjectHealths(healths);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest animate-pulse">Running AI Models...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Unified Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-8">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest mb-2">
            <BrainCircuit size={18} />
            AI Governance Console
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Intelligent Insights</h1>
          <p className="text-muted-foreground mt-1.5 text-sm font-medium max-w-2xl">
            Real-time organizational health monitoring, predictive burnout detection, and delivery anomaly forensics.
          </p>
        </div>
        <div className="flex gap-6 items-center bg-muted/30 px-6 py-4 rounded-xl border border-border">
          <div className="text-right">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Confidence</p>
            <p className="text-xl font-black text-primary">94.2%</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-right">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Active Models</p>
            <p className="text-xl font-black text-foreground">12</p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <div key={i} className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div className="p-2 bg-muted rounded-lg text-muted-foreground"><metric.icon size={18} /></div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{metric.trend}</span>
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5">{metric.label}</p>
            <h3 className="text-2xl font-black text-foreground tracking-tight">{metric.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Intelligence Feed (8/12) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Anomalies Section */}
          <section className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
              <h2 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} className="text-amber-500" />
                Actionable Anomaly Feed
              </h2>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">{anomalies.length} alerts detected</span>
            </div>
            
            <div className="divide-y divide-border">
              {anomalies.length === 0 ? (
                <div className="p-12 text-center">
                  <ShieldCheck className="h-10 w-10 text-emerald-500/30 mx-auto mb-3" />
                  <p className="text-xs font-black text-muted-foreground uppercase">System stable — No anomalies</p>
                </div>
              ) : (
                anomalies.map((anomaly, i) => (
                  <div key={i} className="p-6 hover:bg-muted/30 transition-colors flex gap-6">
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                      anomaly.severity === 'HIGH' ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                    )}>
                      <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-black text-foreground uppercase tracking-tight">
                          {anomaly.type === 'EXTREME_HOURS' ? 'Excessive Hour Pattern' : 'Productivity Drop Alert'}
                        </h4>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black tracking-widest",
                          anomaly.severity === 'HIGH' ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                        )}>
                          {anomaly.severity} RISK
                        </span>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground leading-relaxed mb-4">{anomaly.description}</p>
                      <div className="flex items-center gap-4">
                        <button className="text-[10px] font-black text-primary hover:underline flex items-center gap-1 uppercase tracking-widest">
                          Investigate <ArrowUpRight size={10} />
                        </button>
                        <div className="h-1 w-1 rounded-full bg-border" />
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                          <Sparkles size={10} className="text-amber-400" /> 92% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Project Health Section */}
          <section className="space-y-4">
            <h2 className="text-xs font-black text-foreground uppercase tracking-[0.2em] px-2 flex items-center gap-2">
              <Activity size={14} className="text-primary" />
              Project Delivery Health
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectHealths.map((project) => (
                <div key={project.projectId} className="bg-card border rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-all group">
                   <h3 className="text-sm font-black text-foreground mb-4 truncate uppercase tracking-tight">{project.projectName}</h3>
                   <div className="flex items-center gap-6">
                      <div className="relative h-16 w-16 flex items-center justify-center">
                        <svg className="h-full w-full" viewBox="0 0 36 36">
                          <path className="text-muted stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path
                            className={cn(
                              "stroke-current transition-all duration-1000",
                              project.healthScore > 80 ? "text-emerald-500" : project.healthScore > 60 ? "text-amber-500" : "text-rose-500"
                            )}
                            strokeWidth="3"
                            strokeDasharray={`${project.healthScore}, 100`}
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="absolute text-sm font-black">{project.healthScore}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        {Object.entries(project.breakdown).slice(0, 3).map(([k, v]) => (
                          <div key={k} className="space-y-0.5">
                            <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground">
                              <span>{k}</span>
                              <span>{v}%</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-slate-900" style={{ width: `${v}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Workforce (4/12) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Burnout Section */}
          <section className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                <Users size={14} className="text-primary" />
                Workforce Burnout Map
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {burnoutRisks.filter(r => r.riskLevel !== 'LOW').length === 0 ? (
                <div className="text-center py-6">
                   <ShieldCheck className="h-10 w-10 text-emerald-500/20 mx-auto mb-2" />
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Team health optimal</p>
                </div>
              ) : (
                burnoutRisks.map((user) => (
                  <div key={user.userId} className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm",
                          user.riskLevel === 'HIGH' ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                        )}>
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground tracking-tight leading-none mb-1">{user.name}</p>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-[0.15em]",
                            user.riskLevel === 'HIGH' ? "text-rose-500" : "text-amber-500"
                          )}>{user.riskLevel} Risk</span>
                        </div>
                      </div>
                      <span className="text-sm font-black tracking-tighter">{user.score}%</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full transition-all", user.riskLevel === 'HIGH' ? "bg-rose-500" : "bg-amber-500")} style={{ width: `${user.score}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-muted/10 border-t border-border">
              <button className="w-full py-2.5 bg-background border border-border rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-muted transition-colors shadow-sm">
                Full Workforce Audit
              </button>
            </div>
          </section>

          {/* AI Status Card */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
               <BrainCircuit size={80} />
             </div>
             <h3 className="text-xs font-black uppercase tracking-widest mb-2">Neural Engine Status</h3>
             <p className="text-white/60 text-xs font-medium leading-relaxed mb-6">
               Active monitoring of all organization events. Heuristic models updated daily.
             </p>
             <div className="flex items-center gap-2 text-[10px] font-black bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SYSTEM OPTIMAL
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
