import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectType } from '@prisma/client';

@Injectable()
export class MilestonesService {
  constructor(private prisma: PrismaService) {}

  async create(createMilestoneDto: CreateMilestoneDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: createMilestoneDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createMilestoneDto.projectId} not found`);
    }

    if (project.type !== ProjectType.DEVELOPMENT) {
      throw new BadRequestException('Milestones can only be created for DEVELOPMENT projects');
    }

    return this.prisma.milestone.create({
      data: {
        ...createMilestoneDto,
        dueDate: createMilestoneDto.dueDate ? new Date(createMilestoneDto.dueDate) : null,
      },
    });
  }

  findAll(projectId?: string) {
    return this.prisma.milestone.findMany({
      where: projectId ? { projectId } : undefined,
    });
  }

  async findOne(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone with ID ${id} not found`);
    }

    return milestone;
  }

  async update(id: string, updateMilestoneDto: UpdateMilestoneDto) {
    await this.findOne(id);

    return this.prisma.milestone.update({
      where: { id },
      data: {
        ...updateMilestoneDto,
        dueDate: updateMilestoneDto.dueDate ? new Date(updateMilestoneDto.dueDate) : undefined,
        achievedAt: updateMilestoneDto.achievedAt ? new Date(updateMilestoneDto.achievedAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.milestone.delete({
      where: { id },
    });
  }
}
