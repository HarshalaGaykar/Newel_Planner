'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { AlertCircle, UserPlus, ArrowRight, Zap } from 'lucide-react';

interface OverloadData {
  userId: string;
  totalWorkload: number;
  isOverloaded: boolean;
  overloadAmount: number;
}

export default function PredictiveAlerts({ userId, departmentId }: { userId: string, departmentId: string }) {
  const [data, setData] = useState<OverloadData | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workloadRes, suggestionsRes] = await Promise.all([
          api.get(`/allocation-insights/user/${userId}`),
          api.get(`/allocation-insights/suggestions?departmentId=${departmentId}&minFreeCapacity=20`)
        ]);
        setData(workloadRes.data);
        setSuggestions(suggestionsRes.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, departmentId]);

  if (loading || !data) return null;

  return (
    <div className="space-y-6">
      {data.isOverloaded && (
        <div className="bg-red-50 border-2 border-red-100 p-8 rounded-3xl shadow-xl shadow-red-50">
          <div className="flex items-start gap-6">
            <div className="bg-red-500 p-3 rounded-2xl shadow-lg shadow-red-200">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Resource Overload Detected</h3>
              <p className="text-red-700/70 font-bold mt-1">
                Predicted workload for the next 30 days is <span className="text-red-900 font-black">{data.totalWorkload.toFixed(1)}%</span>. 
                User is over-allocated by {data.overloadAmount.toFixed(1)}%.
              </p>

              <div className="mt-8">
                <h4 className="text-xs font-black text-red-400 uppercase tracking-widest mb-4">Recommended Re-assignments</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suggestions.slice(0, 2).map((s: any) => (
                    <div key={s.userId} className="bg-card p-4 rounded-2xl border border-red-100 flex items-center justify-between group hover:border-red-300 transition cursor-pointer">
                      <div>
                        <div className="text-sm font-black text-foreground">{s.email.split('@')[0]}</div>
                        <div className="text-xs font-bold text-green-500 uppercase">Free Capacity: {s.freeCapacity.toFixed(1)}%</div>
                      </div>
                      <div className="bg-muted p-2 rounded-xl group-hover:bg-red-500 group-hover:text-primary-foreground transition">
                        <UserPlus className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!data.isOverloaded && data.totalWorkload > 80 && (
        <div className="bg-yellow-50 border-2 border-yellow-100 p-6 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Zap className="w-6 h-6 text-yellow-600" />
            <div>
              <h4 className="text-sm font-black text-yellow-900 uppercase tracking-tight">Capacity Warning</h4>
              <p className="text-xs font-bold text-yellow-700/70">Resource is approaching 100% capacity ({data.totalWorkload.toFixed(1)}%).</p>
            </div>
          </div>
          <button className="text-xs font-black text-yellow-900 bg-card px-4 py-2 rounded-xl shadow-sm border border-yellow-100 hover:bg-yellow-100 transition">
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
