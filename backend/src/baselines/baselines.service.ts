import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBaselineDto } from './dto/create-baseline.dto';

export type DeltaType = 'DELAYED' | 'AHEAD' | 'ON_TRACK' | 'ADDED' | 'REMOVED';

export interface DiffEntry {
  taskId: string;
  title: string;
  field: string;
  baselineValue: unknown;
  currentValue: unknown;
  deltaType: DeltaType;
}

@Injectable()
export class BaselinesService {
  constructor(private prisma: PrismaService) {}

  async capture(dto: CreateBaselineDto, userId: string) {
    const { projectId, label } = dto;

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        skills: { include: { skill: true } },
        subTasks: { select: { id: true, title: true } },
      },
    });

    const last = await this.prisma.baseline.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    return this.prisma.baseline.create({
      data: {
        projectId,
        version,
        label,
        snapshotData: tasks as any,
        createdById: userId,
      },
    });
  }

  findAll(projectId: string) {
    return this.prisma.baseline.findMany({
      where: { projectId },
      select: { id: true, version: true, label: true, createdAt: true, createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { version: 'desc' },
    });
  }

  async findOne(id: string) {
    const baseline = await this.prisma.baseline.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!baseline) throw new NotFoundException(`Baseline ${id} not found`);
    return baseline;
  }

  async compare(id: string): Promise<DiffEntry[]> {
    const baseline = await this.findOne(id);
    const snapshot = baseline.snapshotData as any[];

    const currentTasks = await this.prisma.task.findMany({
      where: { projectId: baseline.projectId },
      select: {
        id: true, title: true, status: true, plannedStart: true, plannedEnd: true,
        plannedHours: true, progressPct: true, assigneeId: true, isCritical: true,
      },
    });

    const currentMap = new Map(currentTasks.map((t) => [t.id, t]));
    const snapshotMap = new Map(snapshot.map((t: any) => [t.id, t]));
    const diffs: DiffEntry[] = [];

    const compareDateField = (taskId: string, title: string, field: string, baseVal: string | null, currVal: string | null) => {
      if (baseVal === currVal) return;
      if (!currVal) {
        diffs.push({ taskId, title, field, baselineValue: baseVal, currentValue: currVal, deltaType: 'REMOVED' });
        return;
      }
      if (!baseVal) {
        diffs.push({ taskId, title, field, baselineValue: baseVal, currentValue: currVal, deltaType: 'ADDED' });
        return;
      }
      const baseDt = new Date(baseVal).getTime();
      const currDt = new Date(currVal).getTime();
      const delta: DeltaType = currDt > baseDt ? 'DELAYED' : currDt < baseDt ? 'AHEAD' : 'ON_TRACK';
      diffs.push({ taskId, title, field, baselineValue: baseVal, currentValue: currVal, deltaType: delta });
    };

    for (const snap of snapshot) {
      const current = currentMap.get(snap.id);
      if (!current) {
        diffs.push({ taskId: snap.id, title: snap.title, field: 'task', baselineValue: snap.title, currentValue: null, deltaType: 'REMOVED' });
        continue;
      }
      compareDateField(snap.id, snap.title, 'plannedEnd', snap.plannedEnd, current.plannedEnd ? current.plannedEnd.toISOString() : null);
      compareDateField(snap.id, snap.title, 'plannedStart', snap.plannedStart, current.plannedStart ? current.plannedStart.toISOString() : null);

      if (snap.progressPct !== current.progressPct) {
        const delta: DeltaType = current.progressPct > snap.progressPct ? 'AHEAD' : 'DELAYED';
        diffs.push({ taskId: snap.id, title: snap.title, field: 'progressPct', baselineValue: snap.progressPct, currentValue: current.progressPct, deltaType: delta });
      }
      if (snap.status !== current.status) {
        diffs.push({ taskId: snap.id, title: snap.title, field: 'status', baselineValue: snap.status, currentValue: current.status, deltaType: 'ON_TRACK' });
      }
    }

    for (const current of currentTasks) {
      if (!snapshotMap.has(current.id)) {
        diffs.push({ taskId: current.id, title: current.title, field: 'task', baselineValue: null, currentValue: current.title, deltaType: 'ADDED' });
      }
    }

    return diffs;
  }
}
