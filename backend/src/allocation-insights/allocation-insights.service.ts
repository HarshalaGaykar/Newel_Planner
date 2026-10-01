import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AllocationInsightsService {
  constructor(private prisma: PrismaService) {}

  async analyzeWorkload(userId: string) {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

    // 1. Current Allocations — no percentage anymore, just whether they're booked
    const allocations = await this.prisma.allocation.findMany({
      where: { userId, endDate: { gte: today } },
    });
    const isAllocated = allocations.length > 0;

    // 2. Future Tasks (assigned but not completed)
    // We assume these tasks need to be completed within the next 30 days
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { not: 'COMPLETED' },
        projectId: { in: allocations.map(a => a.projectId) } // Tasks in projects they are allocated to
      }
    });

    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedEffort || 0), 0);
    const availableHoursInMonth = 160; // Standard monthly capacity
    const taskLoadPercentage = (totalEstimatedHours / availableHoursInMonth) * 100;

    return {
      userId,
      isAllocated,
      taskLoadPercentage,
      totalWorkload: taskLoadPercentage,
      isOverloaded: taskLoadPercentage > 100,
      overloadAmount: Math.max(0, taskLoadPercentage - 100),
    };
  }

  async suggestResources(departmentId: string, minFreeCapacity: number) {
    const users = await this.prisma.user.findMany({
      where: { departmentId },
      include: { allocations: { where: { endDate: { gte: new Date() } } } }
    });

    const suggestions = await Promise.all(users.map(async (user) => {
      const workload = await this.analyzeWorkload(user.id);
      return {
        userId: user.id,
        email: user.email,
        isAllocated: workload.isAllocated,
        currentWorkload: workload.totalWorkload,
        freeCapacity: 100 - workload.totalWorkload,
      };
    }));

    return suggestions
      .filter(s => !s.isAllocated && s.freeCapacity >= minFreeCapacity)
      .sort((a, b) => b.freeCapacity - a.freeCapacity);
  }

  async getResourceAvailability(startStr?: string, endStr?: string) {
    const startDate = startStr ? new Date(startStr) : new Date();
    const endDate = endStr ? new Date(endStr) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      include: {
        department: true,
        role: true,
        skills: { include: { skill: true } },
        allocations: {
          where: {
            OR: [
              { startDate: { lte: endDate }, endDate: { gte: startDate } },
            ]
          }
        },
        leaves: {
          where: {
            status: 'APPROVED',
            OR: [
              { startDate: { lte: endDate }, endDate: { gte: startDate } },
            ]
          }
        }
      }
    });

    return users.map(user => {
      // No percentage anymore — a resource is either allocated or free for the period.
      const isAllocated = user.allocations.length > 0;
      const isOnLeave = user.leaves.length > 0;

      let status = 'Available';
      if (isOnLeave) status = 'On Leave';
      else if (isAllocated) status = 'Allocated';

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        avatar: `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`,
        role: user.role?.name || 'Unknown',
        department: user.department?.name || 'Unassigned',
        skills: user.skills.map(s => s.skill.name),
        isAllocated,
        status: status,
      };
    });
  }
}
