import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskTypeDto } from './dto/create-task-type.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateSubActivityDto } from './dto/create-sub-activity.dto';
import { UpdateTaskTypeDto } from './dto/update-task-type.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateSubActivityDto } from './dto/update-sub-activity.dto';

@Injectable()
export class TaskTypeMasterService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Task Types ────────────────────────────────────────────────────────────

  async getTree(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.prisma.taskTypeMaster.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        activities: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            subActivities: {
              where: includeInactive ? {} : { isActive: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });
  }

  async createTaskType(dto: CreateTaskTypeDto, userId: string) {
    const existing = await this.prisma.taskTypeMaster.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`Task type "${dto.name}" already exists`);
    }
    return this.prisma.taskTypeMaster.create({
      data: { ...dto, createdById: userId, updatedById: userId },
    });
  }

  async updateTaskType(id: string, dto: UpdateTaskTypeDto, userId: string) {
    const record = await this.prisma.taskTypeMaster.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Task type not found`);

    if (dto.name && dto.name.toLowerCase() !== record.name.toLowerCase()) {
      const conflict = await this.prisma.taskTypeMaster.findFirst({
        where: { name: { equals: dto.name, mode: 'insensitive' }, id: { not: id } },
      });
      if (conflict) throw new ConflictException(`Task type "${dto.name}" already exists`);
    }

    // Cascade deactivate in a transaction
    if (dto.isActive === false) {
      return this.prisma.$transaction(async (tx) => {
        const activityIds = (
          await tx.taskActivityMaster.findMany({ where: { taskTypeId: id }, select: { id: true } })
        ).map((a) => a.id);

        if (activityIds.length) {
          await tx.taskSubActivityMaster.updateMany({
            where: { activityId: { in: activityIds } },
            data: { isActive: false, updatedById: userId },
          });
          await tx.taskActivityMaster.updateMany({
            where: { taskTypeId: id },
            data: { isActive: false, updatedById: userId },
          });
        }

        return tx.taskTypeMaster.update({
          where: { id },
          data: { ...dto, updatedById: userId },
        });
      });
    }

    return this.prisma.taskTypeMaster.update({
      where: { id },
      data: { ...dto, updatedById: userId },
    });
  }

  // ── Activities ────────────────────────────────────────────────────────────

  async getActivitiesForTaskType(taskTypeId: string, includeInactive = false) {
    const taskType = await this.prisma.taskTypeMaster.findUnique({ where: { id: taskTypeId } });
    if (!taskType) throw new NotFoundException(`Task type not found`);

    return this.prisma.taskActivityMaster.findMany({
      where: { taskTypeId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
      include: {
        subActivities: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  async createActivity(dto: CreateActivityDto, userId: string) {
    const taskType = await this.prisma.taskTypeMaster.findUnique({ where: { id: dto.taskTypeId } });
    if (!taskType) throw new NotFoundException(`Task type not found`);

    const existing = await this.prisma.taskActivityMaster.findFirst({
      where: { taskTypeId: dto.taskTypeId, name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(
        `Activity "${dto.name}" already exists for task type "${taskType.name}"`,
      );
    }

    return this.prisma.taskActivityMaster.create({
      data: { ...dto, createdById: userId, updatedById: userId },
    });
  }

  async updateActivity(id: string, dto: UpdateActivityDto, userId: string) {
    const record = await this.prisma.taskActivityMaster.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Activity not found`);

    if (dto.name && dto.name.toLowerCase() !== record.name.toLowerCase()) {
      const conflict = await this.prisma.taskActivityMaster.findFirst({
        where: {
          taskTypeId: record.taskTypeId,
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (conflict) {
        throw new ConflictException(`Activity "${dto.name}" already exists for this task type`);
      }
    }

    if (dto.isActive === false) {
      return this.prisma.$transaction(async (tx) => {
        await tx.taskSubActivityMaster.updateMany({
          where: { activityId: id },
          data: { isActive: false, updatedById: userId },
        });
        return tx.taskActivityMaster.update({
          where: { id },
          data: { ...dto, updatedById: userId },
        });
      });
    }

    return this.prisma.taskActivityMaster.update({
      where: { id },
      data: { ...dto, updatedById: userId },
    });
  }

  // ── Sub-Activities ────────────────────────────────────────────────────────

  async getSubActivitiesForActivity(activityId: string, includeInactive = false) {
    const activity = await this.prisma.taskActivityMaster.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException(`Activity not found`);

    return this.prisma.taskSubActivityMaster.findMany({
      where: { activityId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async createSubActivity(dto: CreateSubActivityDto, userId: string) {
    const activity = await this.prisma.taskActivityMaster.findUnique({
      where: { id: dto.activityId },
    });
    if (!activity) throw new NotFoundException(`Activity not found`);

    const existing = await this.prisma.taskSubActivityMaster.findFirst({
      where: { activityId: dto.activityId, name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(
        `Sub-activity "${dto.name}" already exists for activity "${activity.name}"`,
      );
    }

    return this.prisma.taskSubActivityMaster.create({
      data: { ...dto, createdById: userId, updatedById: userId },
    });
  }

  async updateSubActivity(id: string, dto: UpdateSubActivityDto, userId: string) {
    const record = await this.prisma.taskSubActivityMaster.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Sub-activity not found`);

    if (dto.name && dto.name.toLowerCase() !== record.name.toLowerCase()) {
      const conflict = await this.prisma.taskSubActivityMaster.findFirst({
        where: {
          activityId: record.activityId,
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (conflict) {
        throw new ConflictException(`Sub-activity "${dto.name}" already exists for this activity`);
      }
    }

    return this.prisma.taskSubActivityMaster.update({
      where: { id },
      data: { ...dto, updatedById: userId },
    });
  }

  // ── Bulk Upload ───────────────────────────────────────────────────────────

  async bulkUpload(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ imported: number; skipped: number; errors: { row: number; message: string }[] }> {
    const workbook = new ExcelJS.Workbook();

    try {
      if (file.originalname.endsWith('.csv')) {
        const stream = new Readable();
        stream.push(file.buffer);
        stream.push(null);
        await workbook.csv.read(stream);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (workbook.xlsx as any).load(file.buffer);
      }
    } catch {
      throw new BadRequestException('Could not parse file. Please upload a valid .xlsx or .csv file.');
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File contains no worksheets.');

    // Normalise header row: find column indices by name (case-insensitive)
    const headerRow = worksheet.getRow(1).values as string[];
    const normalise = (s: string) => (s ?? '').toString().toLowerCase().replace(/[\s\/\-]/g, '');
    const colIndex: Record<string, number> = {};
    (headerRow as any[]).forEach((h, i) => {
      if (h) colIndex[normalise(h)] = i;
    });

    const taskTypeCol = colIndex['tasktype'];
    const activityCol = colIndex['activity'];
    const subActivityCol = colIndex['subactivity'];
    const descriptionCol = colIndex['simplemeaningwhentouse'] ?? colIndex['description'];

    if (taskTypeCol === undefined || activityCol === undefined || subActivityCol === undefined) {
      throw new BadRequestException(
        'Missing required columns. Expected: "Task Type", "Activity", "Sub-Activity".',
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    // Cache task types and activities to avoid N+1 DB calls per row
    const taskTypeCache = new Map<string, string>(); // name.lower → id
    const activityCache = new Map<string, string>(); // `${taskTypeId}::name.lower` → id

    const totalRows = worksheet.rowCount;

    for (let rowNum = 2; rowNum <= totalRows; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rawTaskType = (row.getCell(taskTypeCol).value ?? '').toString().trim();
      const rawActivity = (row.getCell(activityCol).value ?? '').toString().trim();
      const rawSubActivity = (row.getCell(subActivityCol).value ?? '').toString().trim();
      const rawDescription = descriptionCol
        ? (row.getCell(descriptionCol).value ?? '').toString().trim()
        : '';

      if (!rawTaskType && !rawActivity && !rawSubActivity) continue; // skip blank rows

      if (!rawTaskType || !rawActivity || !rawSubActivity) {
        errors.push({ row: rowNum, message: 'Task Type, Activity and Sub-Activity are all required.' });
        continue;
      }

      try {
        // 1. Upsert task type
        const ttKey = rawTaskType.toLowerCase();
        let taskTypeId = taskTypeCache.get(ttKey);
        if (!taskTypeId) {
          let tt = await this.prisma.taskTypeMaster.findFirst({
            where: { name: { equals: rawTaskType, mode: 'insensitive' } },
          });
          if (!tt) {
            tt = await this.prisma.taskTypeMaster.create({
              data: { name: rawTaskType, createdById: userId, updatedById: userId },
            });
          }
          taskTypeId = tt.id;
          taskTypeCache.set(ttKey, taskTypeId);
        }

        // 2. Upsert activity
        const actKey = `${taskTypeId}::${rawActivity.toLowerCase()}`;
        let activityId = activityCache.get(actKey);
        if (!activityId) {
          let act = await this.prisma.taskActivityMaster.findFirst({
            where: { taskTypeId, name: { equals: rawActivity, mode: 'insensitive' } },
          });
          if (!act) {
            act = await this.prisma.taskActivityMaster.create({
              data: { taskTypeId, name: rawActivity, createdById: userId, updatedById: userId },
            });
          }
          activityId = act.id;
          activityCache.set(actKey, activityId);
        }

        // 3. Upsert sub-activity
        const existingSub = await this.prisma.taskSubActivityMaster.findFirst({
          where: { activityId, name: { equals: rawSubActivity, mode: 'insensitive' } },
        });
        if (existingSub) {
          skipped++;
        } else {
          await this.prisma.taskSubActivityMaster.create({
            data: {
              activityId,
              name: rawSubActivity,
              description: rawDescription || null,
              createdById: userId,
              updatedById: userId,
            },
          });
          imported++;
        }
      } catch (err: any) {
        errors.push({ row: rowNum, message: err?.message ?? 'Unknown error' });
      }
    }

    return { imported, skipped, errors };
  }
}
