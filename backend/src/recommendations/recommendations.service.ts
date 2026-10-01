import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllocationInsightsService } from '../allocation-insights/allocation-insights.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private prisma: PrismaService,
    private insightsService: AllocationInsightsService
  ) {}

  async recommendResources(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { skills: { include: { skill: true } } }
    });

    if (!task) throw new NotFoundException('Task not found');

    const skillIds = task.skills.map(rs => rs.skillId);

    // 1. Find users with at least one matching skill
    const candidates = await this.prisma.user.findMany({
      where: {
        skills: { some: { skillId: { in: skillIds } } }
      },
      include: {
        skills: true,
        role: true,
      }
    });

    // 2. Score candidates based on skill match and workload
    const scoredCandidates = await Promise.all(candidates.map(async (user) => {
      const matchCount = user.skills.filter(s => skillIds.includes(s.skillId)).length;
      const workload = await this.insightsService.analyzeWorkload(user.id);
      
      // Score: 60% skills, 40% availability
      const skillScore = skillIds.length > 0 ? (matchCount / skillIds.length) * 100 : 100;
      const availabilityScore = Math.max(0, 100 - workload.totalWorkload);
      
      const finalScore = (skillScore * 0.6) + (availabilityScore * 0.4);

      return {
        userId: user.id,
        email: user.email,
        role: user.role.name,
        matchScore: Math.round(finalScore),
        skillMatchCount: matchCount,
        totalSkillsNeeded: skillIds.length,
        currentWorkload: Math.round(workload.totalWorkload),
      };
    }));

    return scoredCandidates
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  }

  async suggestDeadlineAdjustment(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || !task.estimatedEffort) return { message: 'No estimate found for task' };

    // Simple logic: if best candidate is overloaded, suggest +25% time
    const recommendations = await this.recommendResources(taskId);
    const bestCandidate = recommendations[0];

    if (bestCandidate && bestCandidate.currentWorkload > 90) {
      return {
        currentEstimate: task.estimatedEffort,
        suggestedShiftDays: Math.ceil(task.estimatedEffort / 8 * 0.25),
        reason: 'Primary recommended resource is heavily loaded.'
      };
    }

    return { suggestedShiftDays: 0, reason: 'Optimal resource available within original timeline.' };
  }
}
