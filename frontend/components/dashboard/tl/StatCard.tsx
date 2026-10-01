'use client';

import { LucideIcon, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TlTrend } from '@/lib/tl-dashboard-api';

interface StatCardProps {
  label: string;
  icon: LucideIcon;
  count: number;
  trend: TlTrend;
}

const TREND_STYLES: Record<TlTrend['direction'], { badge: string; icon: LucideIcon; text: (t: TlTrend) => string }> = {
  UP: {
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    icon: TrendingUp,
    text: (t) => `+${t.trendPct}%`,
  },
  DOWN: {
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
    icon: TrendingDown,
    text: (t) => `${t.trendPct}%`, // already negative
  },
  FLAT: {
    badge: 'bg-muted text-muted-foreground',
    icon: Minus,
    text: () => 'No change',
  },
  NEW: {
    badge: 'bg-primary/10 text-primary',
    icon: Sparkles,
    text: () => 'New activity',
  },
};

export default function StatCard({ label, icon: Icon, count, trend }: StatCardProps) {
  const style = TREND_STYLES[trend.direction];
  const TrendIcon = style.icon;

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <h5 className="text-sm font-medium text-muted-foreground">{label}</h5>
          <div className="p-2.5 rounded-full outline outline-border text-primary shrink-0">
            <Icon size={16} />
          </div>
        </div>
        <div className="flex flex-col gap-1 mt-2">
          <h3 className="text-2xl font-semibold text-foreground tabular-nums">{count}</h3>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">This period</p>
            <Badge className={cn(style.badge, 'font-medium')}>
              <div className="flex items-center gap-1">
                {style.text(trend)}
                <TrendIcon size={12} />
              </div>
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
