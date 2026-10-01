'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { AlertTriangle, Activity, User, Calendar, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Anomaly {
  id?: string;
  type: 'EXTREME_HOURS' | 'PRODUCTIVITY_DROP';
  severity: 'HIGH' | 'MEDIUM';
  userEmail: string;
  description: string;
  date?: string;
  hours?: number;
}

export default function AnomalyDashboard() {
  const [alerts, setAlerts] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.get('/anomalies');
        setAlerts(res.data);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const getSeverityStyles = (severity: string) => {
    if (severity === 'HIGH') return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-amber-50 text-amber-600 border-amber-100';
  };

  if (loading) return <div className="p-20 text-center font-black text-muted-foreground/50 animate-pulse">Scanning system for irregularities...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-foreground" />
            Integrity Monitor
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Automatic detection of timesheet anomalies and productivity shifts.</p>
        </div>
        <div className="bg-card px-6 py-3 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs font-black text-muted-foreground uppercase tracking-widest">Active Alerts</div>
            <div className="text-2xl font-black text-foreground">{alerts.length}</div>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${alerts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
            {alerts.length > 0 ? <AlertTriangle /> : <CheckCircle2 />}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {alerts.length === 0 ? (
          <div className="bg-card p-20 rounded-xl border border-border text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h3 className="text-xl font-black text-foreground">System Integrity Confirmed</h3>
            <p className="text-muted-foreground font-medium mt-2">No anomalies detected in the current reporting period.</p>
          </div>
        ) : (
          alerts.map((alert, i) => (
            <div key={i} className={`bg-card p-6 rounded-3xl border-2 transition hover:shadow-lg flex items-center justify-between group ${getSeverityStyles(alert.severity)}`}>
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${alert.severity === 'HIGH' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                  {alert.type === 'EXTREME_HOURS' ? <Calendar className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black uppercase tracking-widest opacity-60">{alert.type.replace('_', ' ')}</span>
                    <span className="w-1 h-1 rounded-full bg-current opacity-30"></span>
                    <span className="text-xs font-bold">{alert.userEmail}</span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-foreground">{alert.description}</h3>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button className="bg-card text-foreground px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-border hover:bg-muted transition shadow-sm">
                  Investigate
                </button>
                <button className="p-2.5 rounded-xl hover:bg-card/50 text-muted-foreground hover:text-muted-foreground transition">
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
