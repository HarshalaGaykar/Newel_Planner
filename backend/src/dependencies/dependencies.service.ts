import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyStatus, DependencyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { UpdateDependencyDto } from './dto/update-dependency.dto';

const DEP_INCLUDE = {
  owner:    { select: { id: true, firstName: true, lastName: true } },
  fromTask: { select: { id: true, title: true } },
  toTask:   { select: { id: true, title: true } },
} as const;

@Injectable()
export class DependenciesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDependencyDto) {
    const { dueDate, projectId, type, status, ...rest } = dto;
    return this.prisma.dependency.create({
      data: {
        ...rest,
        projectId,
        type: type as DependencyType,
        status: status as DependencyStatus,
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      },
      include: DEP_INCLUDE,
    });
  }

  findAll(projectId?: string, status?: string) {
    return this.prisma.dependency.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: DEP_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const dep = await this.prisma.dependency.findUnique({ where: { id }, include: DEP_INCLUDE });
    if (!dep) throw new NotFoundException(`Dependency ${id} not found`);
    return dep;
  }

  async update(id: string, dto: UpdateDependencyDto) {
    await this.findOne(id);
    const { dueDate, projectId, type, status, ...rest } = dto;
    return this.prisma.dependency.update({
      where: { id },
      data: {
        ...rest,
        ...(type ? { type: type as DependencyType } : {}),
        ...(status ? { status: status as DependencyStatus } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
      include: DEP_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.dependency.delete({ where: { id } });
  }
}
