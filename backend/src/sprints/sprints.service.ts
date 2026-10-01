import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, SprintStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddTasksDto } from './dto/add-tasks.dto';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';

@Injectable()
export class SprintsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateSprintDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException(`Project ${dto.projectId} not found`);
    if (project.status !== 'ACTIVE') {
      throw new BadRequestException('Sprints can only be created for ACTIVE projects');
    }

    return this.prisma.sprint.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        goal: dto.goal,
        startDate: start,
        endDate: end,
        capacity: dto.capacity,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  findAll(projectId?: string) {
    return this.prisma.sprint.findMany({
      where: { projectId: projectId || undefined },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!sprint) throw new NotFoundException(`Sprint ${id} not found`);
    return sprint;
  }

  async update(id: string, dto: UpdateSprintDto) {
    await this.findOne(id);
    if (dto.startDate && dto.endDate && new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }
    const { projectId, startDate, endDate, status, ...rest } = dto;
    return this.prisma.sprint.update({
      where: { id },
      data: {
        ...rest,
        status: status as SprintStatus,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });
  }

  async start(id: string) {
    const sprint = await this.findOne(id);

    if (sprint.status !== 'PLANNED') {
      throw new BadRequestException('Only PLANNED sprints can be started');
    }

    const activeSprint = await this.prisma.sprint.findFirst({
      where: { projectId: sprint.projectId, status: 'ACTIVE' },
    });
    if (activeSprint) {
      throw new ConflictException(
        `Sprint "${activeSprint.name}" is already active for this project`,
      );
    }

    const updated = await this.prisma.sprint.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    const allocations = await this.prisma.allocation.findMany({
      where: { projectId: sprint.projectId, userId: { not: null } },
      select: { userId: true },
    });

    await Promise.allSettled(
      allocations
        .filter((a) => a.userId)
        .map((a) =>
          this.notifications.send(
            a.userId!,
            NotificationType.GENERAL,
            `Sprint Started: ${sprint.name}`,
            `Sprint "${sprint.name}" has been started for project "${sprint.project.name}". Work begins now!`,
            { entityType: 'SPRINT', entityId: id },
          ),
        ),
    );

    return updated;
  }

  async complete(id: string) {
    const sprint = await this.findOne(id);

    if (sprint.status !== 'ACTIVE') {
      throw new BadRequestException('Only ACTIVE sprints can be completed');
    }

    const planned = sprint.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const velocity = sprint.tasks
      .filter((t) => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    const incompleteTaskIds = sprint.tasks
      .filter((t) => t.status !== 'COMPLETED')
      .map((t) => t.id);

    await this.prisma.$transaction([
      this.prisma.sprint.update({
        where: { id },
        data: { status: 'COMPLETED', velocity },
      }),
      this.prisma.task.updateMany({
        where: { id: { in: incompleteTaskIds } },
        data: { sprintId: null },
      }),
    ]);

    return {
      planned,
      completed: velocity,
      velocity,
      incompleteTasksMovedToBacklog: incompleteTaskIds.length,
    };
  }

  async addTasks(id: string, dto: AddTasksDto) {
    await this.findOne(id);
    await this.prisma.task.updateMany({
      where: { id: { in: dto.taskIds } },
      data: { sprintId: id },
    });
    return this.findOne(id);
  }

  async removeTask(sprintId: string, taskId: string) {
    await this.findOne(sprintId);
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    await this.prisma.task.update({
      where: { id: taskId },
      data: { sprintId: null },
    });
    return { message: 'Task moved to backlog' };
  }

  async getBurndown(id: string) {
    const sprint = await this.findOne(id);
    const capacity =
      sprint.capacity ?? sprint.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    const start = new Date(sprint.startDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    const sprintEnd = new Date(sprint.endDate);
    const end = today < sprintEnd ? today : sprintEnd;

    const result: { date: string; totalPoints: number; completedPoints: number; remainingPoints: number }[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);

      const completedPoints = sprint.tasks
        .filter((t) => t.status === 'COMPLETED' && t.updatedAt <= dayEnd)
        .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

      result.push({
        date: cursor.toISOString().split('T')[0],
        totalPoints: capacity,
        completedPoints,
        remainingPoints: Math.max(0, capacity - completedPoints),
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  async getBacklog(projectId: string) {
    return this.prisma.task.findMany({
      where: {
        projectId,
        sprintId: null,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        milestone: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'asc' }, { storyPoints: 'asc' }],
    });
  }
}
