import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnomaliesService {
  constructor(private prisma: PrismaService) {}

  async getAlerts() {
    const excessiveHours = await this.detectExcessiveHours();
    const productivityDrops = await this.detectAllProductivityDrops();

    return [
      ...excessiveHours.map(a => ({ ...a, type: 'EXTREME_HOURS', severity: 'HIGH' })),
      ...productivityDrops.map(a => ({ ...a, type: 'PRODUCTIVITY_DROP', severity: 'MEDIUM' })),
    ];
  }

  private async detectExcessiveHours() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

    const entries = await this.prisma.timesheetEntry.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      include: {
        timesheet: { include: { user: { select: { email: true } } } }
      }
    });

    // 1. Calculate Mean and StdDev for all entries in the last 30 days
    const hours = entries.map(e => e.hours);
    const mean = hours.reduce((a, b) => a + b, 0) / (hours.length || 1);
    const stdDev = Math.sqrt(hours.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (hours.length || 1));

    // 2. Identify outliers (Z-Score > 2.5)
    const anomalies = entries.filter(e => {
      const zScore = (e.hours - mean) / (stdDev || 1);
      return zScore > 2.5;
    });

    return anomalies.map(e => ({
      id: e.id,
      userId: e.timesheet.userId,
      userEmail: e.timesheet.user?.email ?? 'unknown',
      date: e.date,
      hours: e.hours,
      description: `Statistical anomaly (Z-Score: ${((e.hours - mean) / (stdDev || 1)).toFixed(2)}). User logged ${e.hours}h while org average is ${mean.toFixed(1)}h.`,
    }));
  }

  private async detectAllProductivityDrops() {
    const users = await this.prisma.user.findMany({ where: { isActive: true } });
    const alerts: any[] = [];

    for (const user of users) {
      const drop = await this.detectUserProductivityDrop(user.id);
      if (drop) alerts.push({ ...drop, userEmail: user.email });
    }

    return alerts;
  }

  private async detectUserProductivityDrop(userId: string) {
    const today = new Date();
    const fourWeeksAgo = new Date(today.getTime() - (28 * 24 * 60 * 60 * 1000));

    // Get entries for the last 4 weeks
    const entries = await this.prisma.timesheetEntry.findMany({
      where: {
        timesheet: { userId },
        date: { gte: fourWeeksAgo }
      }
    });

    // Group by week
    const weeklyHours: Record<number, number> = {};
    entries.forEach(e => {
      const week = Math.floor(e.date.getTime() / (7 * 24 * 60 * 60 * 1000));
      weeklyHours[week] = (weeklyHours[week] || 0) + e.hours;
    });

    const weeks = Object.values(weeklyHours).sort();
    if (weeks.length < 2) return null;

    const currentWeekHours = weeks[weeks.length - 1];
    const pastWeeks = weeks.slice(0, weeks.length - 1);
    const avgPastHours = pastWeeks.reduce((a, b) => a + b, 0) / pastWeeks.length;

    // Trigger if current week is < 50% of average and not on leave (simplified)
    if (avgPastHours > 10 && currentWeekHours < (avgPastHours * 0.5)) {
      return {
        userId,
        currentWeekHours,
        avgPastHours,
        description: `Productivity drop detected: ${currentWeekHours}h vs ${avgPastHours.toFixed(1)}h avg.`,
      };
    }

    return null;
  }
}
