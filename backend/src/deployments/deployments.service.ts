import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentDto } from './dto/update-deployment.dto';

@Injectable()
export class DeploymentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDeploymentDto, userId: string) {
    const { taskIds, ticketIds, ...rest } = dto;
    return this.prisma.deployment.create({
      data: {
        ...rest,
        deployedById: userId,
        tasks: taskIds?.length ? { connect: taskIds.map(id => ({ id })) } : undefined,
        tickets: ticketIds?.length ? { connect: ticketIds.map(id => ({ id })) } : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
        deployedBy: { select: { id: true, firstName: true, lastName: true } },
        sprint: { select: { id: true, name: true } },
      },
    });
  }

  findAll(projectId?: string) {
    return this.prisma.deployment.findMany({
      where: projectId ? { projectId } : {},
      include: {
        project: { select: { id: true, name: true } },
        deployedBy: { select: { id: true, firstName: true, lastName: true } },
        sprint: { select: { id: true, name: true } },
      },
      orderBy: { deployedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        deployedBy: { select: { id: true, firstName: true, lastName: true } },
        sprint: { select: { id: true, name: true } },
        testRuns: { select: { id: true, name: true, status: true } },
        tasks: { select: { id: true, title: true, status: true } },
        tickets: { select: { id: true, title: true, status: true } },
      },
    });
    if (!deployment) throw new NotFoundException('Deployment not found');
    return deployment;
  }

  async update(id: string, dto: UpdateDeploymentDto) {
    await this.findOne(id);
    const { taskIds, ticketIds, ...rest } = dto;
    
    // For many-to-many or one-to-many list updates, 'set' replaces the existing connections.
    return this.prisma.deployment.update({
      where: { id },
      data: {
        ...rest,
        ...(taskIds !== undefined && { tasks: { set: taskIds.map(id => ({ id })) } }),
        ...(ticketIds !== undefined && { tickets: { set: ticketIds.map(id => ({ id })) } }),
      },
      include: {
        project: { select: { id: true, name: true } },
        deployedBy: { select: { id: true, firstName: true, lastName: true } },
        sprint: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.deployment.delete({ where: { id } });
  }
}
