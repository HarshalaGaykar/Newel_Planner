import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllocationInsightsService } from '../allocation-insights/allocation-insights.service';
import { AnomaliesService } from '../anomalies/anomalies.service';
import { IssueSeverity } from '@prisma/client';

@Injectable()
export class AdvancedAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private allocationInsights: AllocationInsightsService,
    private anomaliesService: AnomaliesService,
  ) {}

  async getAnomalies() {
    return this.anomaliesService.getAlerts();
  }


  async getBurnoutRisk() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: { isActive: true, employmentStatus: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        attendance: {
          where: { date: { gte: thirtyDaysAgo } },
          select: { date: true, checkIn: true, checkOut: true, overtimeHours: true },
        },
        timesheets: {
          where: { startDate: { gte: thirtyDaysAgo } },
          include: { entries: true },
        },
        leaveBalances: {
          select: { leaveTypeCode: true, earnedBalance: true, usedBalance: true, carryForward: true },
        },
      },
    });

    const results = await Promise.all(
      users.map(async (user) => {
        const riskFactors: string[] = [];
        let score = 0;

        // 1. Overtime Analysis (Timesheets)
        user.timesheets.forEach((ts) => {
          const total = ts.entries.reduce((sum, e) => sum + e.hours, 0);
          if (total > 50) {
            score += 30;
            riskFactors.push(`High weekly hours: ${total}h in week starting ${ts.startDate.toLocaleDateString()}`);
          }
        });

        // 2. Late Night Analysis (Attendance)
        const lateCheckouts = user.attendance.filter((a) => {
          if (!a.checkOut) return false;
          const hour = new Date(a.checkOut).getHours();
          return hour >= 20; // 8 PM
        });
        if (lateCheckouts.length >= 4) {
          score += 20;
          riskFactors.push(`Frequent late check-outs (${lateCheckouts.length} in 30 days)`);
        }

        // 3. Workload Analysis (from Allocation Insights)
        const workload = await this.allocationInsights.analyzeWorkload(user.id);
        if (workload.totalWorkload > 110) {
          score += 25;
          riskFactors.push(`Heavy workload: ${workload.totalWorkload.toFixed(1)}% (Allocations + Tasks)`);
        }

        // 4. Leave Utilization
        const totalEarned = user.leaveBalances.reduce((s, lb) => s + lb.earnedBalance + lb.carryForward, 0);
        const totalUsed = user.leaveBalances.reduce((s, lb) => s + lb.usedBalance, 0);
        if (totalEarned > 15 && totalUsed < 2) {
          score += 15;
          riskFactors.push('Low leave utilization (less than 2 days used with high balance)');
        }

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (score >= 60) riskLevel = 'HIGH';
        else if (score >= 30) riskLevel = 'MEDIUM';

        return {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          riskLevel,
          score,
          riskFactors,
        };
      }),
    );

    return results.sort((a, b) => b.score - a.score);
  }

  async getProjectHealthScore(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        risks: { where: { status: { not: 'CLOSED' } } },
        issues: { where: { status: { not: 'CLOSED' } } },
        tickets: { select: { isSlaBreached: true } },
        timesheetEntries: true,
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const penalties: Record<string, number> = {
      risks: 0,
      issues: 0,
      sla: 0,
      budget: 0,
    };

    // 1. Risks Penalty
    if (project.risks.length > 0) {
      const totalRiskScore = project.risks.reduce((sum, r) => sum + (r.riskScore || 0), 0);
      const maxPossibleRisk = project.risks.length * 16;
      penalties.risks = (totalRiskScore / maxPossibleRisk) * 100;
    }

    // 2. Issues Penalty
    if (project.issues.length > 0) {
      const SEVERITY_MAP: Record<IssueSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const totalIssueScore = project.issues.reduce((sum, i) => sum + SEVERITY_MAP[i.severity], 0);
      const maxPossibleIssue = project.issues.length * 4;
      penalties.issues = (totalIssueScore / maxPossibleIssue) * 100;
    }

    // 3. SLA Penalty
    if (project.tickets.length > 0) {
      const breached = project.tickets.filter((t) => t.isSlaBreached).length;
      penalties.sla = (breached / project.tickets.length) * 100;
    }

    // 4. Budget Penalty
    const actualHours = project.timesheetEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const budgetHours = project.budgetHours || 1; // avoid div by zero
    if (actualHours > budgetHours) {
      penalties.budget = Math.min(100, ((actualHours - budgetHours) / budgetHours) * 100);
    }

    const avgPenalty = (penalties.risks + penalties.issues + penalties.sla + penalties.budget) / 4;
    const healthScore = Math.max(0, 100 - avgPenalty);

    return {
      projectId,
      projectName: project.name,
      healthScore: Math.round(healthScore),
      breakdown: {
        risks: Math.round(penalties.risks),
        issues: Math.round(penalties.issues),
        sla: Math.round(penalties.sla),
        budget: Math.round(penalties.budget),
      },
      concerns: this.getConcerns(project, penalties),
    };
  }

  private getConcerns(project: any, penalties: any) {
    const concerns: string[] = [];
    if (penalties.risks > 50) concerns.push('High concentration of unmitigated risks');
    if (penalties.issues > 50) concerns.push('Critical issues affecting delivery');
    if (penalties.sla > 20) concerns.push('High rate of SLA breaches');
    if (penalties.budget > 10) concerns.push('Budget burn exceeding estimates');
    return concerns;
  }
}
