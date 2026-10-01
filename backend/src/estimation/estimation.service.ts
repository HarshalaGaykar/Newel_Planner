import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EstimationService {
  constructor(private prisma: PrismaService) {}

  async estimateEffort(activity: string, subActivity: string, complexity: string) {
    // 1. Fetch historical entries for similar tasks and complexity
    // We look for entries where the associated task/ticket had the target complexity
    const historicalEntries = await this.prisma.timesheetEntry.findMany({
      where: {
        activityMaster: {
          activity,
          subActivity,
        },
        OR: [
          { task: { complexity: complexity as any } },
          { ticket: { complexity: complexity as any } },
        ],
      },
      include: {
        timesheet: {
          include: {
            user: {
              include: { role: true }
            }
          }
        }
      }
    }) as any[]; // Type casting to bypass Prisma's temporary inference issues

    if (historicalEntries.length === 0) {
      // Default fallback values if no history exists
      const baseMap: Record<string, number> = { 'LOW': 4, 'MEDIUM': 12, 'HIGH': 32 };
      return { suggestedHours: baseMap[complexity] || 8, confidence: 'LOW' };
    }

    // 2. Calculate Weighted Average
    let totalWeightedHours = 0;
    let totalWeight = 0;

    historicalEntries.forEach(entry => {
      const roleName = entry.timesheet?.user?.role?.name;
      let weight = 1;
      if (roleName === 'PM' || roleName === 'ADMIN') weight = 2; // Experts
      if (roleName === 'TL') weight = 1.5;

      totalWeightedHours += entry.hours * weight;
      totalWeight += weight;
    });

    const suggestedHours = totalWeightedHours / totalWeight;

    return {
      suggestedHours: Math.round(suggestedHours * 10) / 10,
      sampleSize: historicalEntries.length,
      confidence: historicalEntries.length > 5 ? 'HIGH' : 'MEDIUM',
    };
  }
}
