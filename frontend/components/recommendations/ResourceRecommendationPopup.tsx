'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { UserCheck, Clock, ShieldCheck, ChevronRight, Info } from 'lucide-react';

interface Recommendation {
  userId: string;
  email: string;
  role: string;
  matchScore: number;
  skillMatchCount: number;
  totalSkillsNeeded: number;
  currentWorkload: number;
}

export default function ResourceRecommendationPopup({ taskId }: { taskId: string }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [deadlineInsight, setDeadlineInsight] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recRes, deadlineRes] = await Promise.all([
          api.get(`/recommendations/resources/${taskId}`),
          api.get(`/recommendations/deadline/${taskId}`)
        ]);
        setRecommendations(recRes.data);
        setDeadlineInsight(deadlineRes.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [taskId]);

  if (loading) return <div className="p-10 text-center font-bold text-muted-foreground">Finding best matches...</div>;

  return (
    <div className="bg-card rounded-xl border border-border shadow-2xl overflow-hidden max-w-lg w-full">
      <div className="p-8 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-black uppercase tracking-widest text-blue-100">Smart Assignment Engine</h2>
        </div>
        <p className="text-muted-foreground text-xs font-bold">Optimizing for skill fit and resource availability.</p>
      </div>

      <div className="p-8 space-y-6">
        {/* Candidates List */}
        <div>
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4">Top Matches</h3>
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.userId} className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/50 hover:bg-card hover:border-blue-200 transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xs">
                    {rec.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-black text-foreground">{rec.email.split('@')[0]}</div>
                    <div className="text-xs font-bold text-muted-foreground">{rec.role} • {rec.skillMatchCount}/{rec.totalSkillsNeeded} Skills</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-blue-600">{rec.matchScore}%</div>
                  <div className={`text-xs font-black uppercase ${rec.currentWorkload > 90 ? 'text-red-500' : 'text-green-500'}`}>
                    Load: {rec.currentWorkload}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Insights */}
        {deadlineInsight && deadlineInsight.suggestedShiftDays > 0 && (
          <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
            <div className="flex items-start gap-4">
              <Clock className="w-5 h-5 text-orange-600 mt-1" />
              <div>
                <h4 className="text-sm font-black text-orange-900">Schedule Adjustment Suggested</h4>
                <p className="text-xs font-bold text-orange-700/70 mt-1 leading-relaxed">
                  Best candidates are currently overloaded. Consider extending the deadline by <span className="text-orange-900 font-black">{deadlineInsight.suggestedShiftDays} days</span> to maintain quality.
                </p>
                <button className="mt-4 flex items-center gap-2 text-xs font-black text-orange-900 uppercase tracking-widest hover:gap-3 transition-all">
                  Accept Shift <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!deadlineInsight?.suggestedShiftDays && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-2xl">
            <UserCheck className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-tighter">Timeline is safe with optimal resource.</span>
          </div>
        )}
      </div>
    </div>
  );
}
