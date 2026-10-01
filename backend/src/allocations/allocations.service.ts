import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ResourceType } from '@prisma/client';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { UpdateAllocationDto } from './dto/update-allocation.dto';
import { PrismaService } from '../prisma/prisma.service';
import { FreelancersService } from '../freelancers/freelancers.service';
import { ScopeResolverService } from '../common/scope-resolver.service';

export interface AllocationWarning {
  type: string;
  message: string;
  missingSkills?: { id: string; name: string }[];
}

type PreparedAllocation = {
  data: Prisma.AllocationCreateInput;
  warnings: AllocationWarning[];
};

@Injectable()
export class AllocationsService {
  constructor(
    private prisma: PrismaService,
    private freelancersService: FreelancersService,
    private scopeResolver: ScopeResolverService,
  ) {}

  async create(createAllocationDto: CreateAllocationDto) {
    const { data, warnings } = await this.prepareAllocation(createAllocationDto);
    const allocation = await this.prisma.allocation.create({
      data,
      include: this.allocationInclude(),
    });

    return { allocation, warnings };
  }

  async createBulk(dtos: CreateAllocationDto[]) {
    if (!dtos.length) {
      throw new BadRequestException('At least one allocation is required');
    }

    const prepared: PreparedAllocation[] = [];
    const errors: { row: number; message: string }[] = [];

    for (const [index, dto] of dtos.entries()) {
      try {
        const item = await this.prepareAllocation(dto);
        prepared.push(item);
      } catch (error: any) {
        const response = typeof error.getResponse === 'function' ? error.getResponse() : null;
        const message = response && typeof response === 'object' && 'message' in response
          ? (response as any).message
          : error.message;
        errors.push({
          row: index + 1,
          message: Array.isArray(message) ? message.join(', ') : message || 'Invalid allocation',
        });
      }
    }

    if (errors.length) {
      throw new BadRequestException({ message: 'Bulk allocation validation failed', errors });
    }

    const allocations = await this.prisma.$transaction(
      prepared.map((item) => this.prisma.allocation.create({
        data: item.data,
        include: this.allocationInclude(),
      })),
    );

    return {
      allocations,
      warnings: prepared.map((item, index) => ({ row: index + 1, warnings: item.warnings })),
    };
  }

  async findAll(
    actorId: string,
    actorRole: string,
    userId?: string,
    projectId?: string,
    freelancerId?: string,
    activeOnly = false,
    from?: string,
    to?: string,
  ) {
    const scope = await this.scopeResolver.getDataScope(actorRole, 'PROJECT_ALLOCATION_VIEW');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    // An explicit from/to range (e.g. "show me last quarter") takes precedence
    // over the "active today" shorthand — an allocation is in range as long as
    // it hasn't ended before `from` and hasn't started after `to`. With neither
    // supplied, and activeOnly not set, allocations of every date are returned.
    let dateFilter: { startDate?: { lte: Date }; endDate?: { gte: Date } } | undefined;
    if (from || to) {
      dateFilter = {
        ...(to ? { startDate: { lte: new Date(`${to}T23:59:59.999`) } } : {}),
        ...(from ? { endDate: { gte: new Date(`${from}T00:00:00.000`) } } : {}),
      };
    } else if (activeOnly) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);
      dateFilter = { startDate: { lte: todayEnd }, endDate: { gte: todayStart } };
    }

    const where: any = {
      projectId: projectId || undefined,
      freelancerId: freelancerId || undefined,
      ...dateFilter,
    };

    if (userId) {
      where.userId = userId;
    } else if (projectId) {
      // A project allocation view should show all resources allocated to that project.
    } else if (['PM', 'TL'].includes(actorRole)) {
      const projects = await this.prisma.project.findMany({
        where: {
          OR: [
            { pmId: actorId },
            { createdById: actorId },
            { allocations: { some: { userId: actorId } } },
          ],
        },
        select: { id: true },
      });
      where.projectId = { in: projects.map((project) => project.id) };
    } else if (allowedIds) {
      where.userId = { in: allowedIds };
    }

    return this.prisma.allocation.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: { select: { name: true } },
          },
        },
        freelancer: { select: { id: true, fullName: true, email: true, vendorId: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.allocation.findUnique({
      where: { id },
      include: this.allocationInclude(),
    });
  }

  async update(id: string, dto: UpdateAllocationDto) {
    const existing = await this.prisma.allocation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Allocation "${id}" not found`);

    const start = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (start > end) throw new BadRequestException('Start date cannot be after end date');

    return this.prisma.allocation.update({
      where: { id },
      data: {
        startDate: start,
        endDate: end,
        projectRole: dto.projectRole !== undefined ? dto.projectRole : existing.projectRole,
      },
      include: this.allocationInclude(),
    });
  }

  async remove(id: string) {
    return this.prisma.allocation.delete({ where: { id } });
  }

  async getResourceAvailability(date?: string, skillIds?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const skillIdArray = skillIds ? skillIds.split(',').filter(Boolean) : undefined;

    const userWhere = skillIdArray?.length
      ? { isActive: true, skills: { some: { skillId: { in: skillIdArray } } } }
      : { isActive: true };

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { name: true } },
        department: { select: { name: true } },
        skills: {
          select: {
            skillId: true,
            skill: { select: { id: true, name: true } },
          },
        },
      },
    });

    const userIds = users.map(u => u.id);
    const allocations = await this.prisma.allocation.findMany({
      where: {
        userId: { in: userIds },
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
      select: {
        userId: true,
        endDate: true,
        project: { select: { id: true, name: true } },
      },
    });

    return users.map(u => {
      const userAllocations = allocations.filter(a => a.userId === u.id);
      return {
        userId: u.id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        email: u.email,
        role: u.role?.name ?? '',
        department: u.department?.name ?? '',
        skills: u.skills.map(us => ({ id: us.skill.id, name: us.skill.name })),
        // No percentage anymore — a resource is either allocated (booked, on
        // any number of projects — overlap is blocked at write time so there
        // is at most one) or free on the target date.
        isAllocated: userAllocations.length > 0,
        allocations: userAllocations.map(a => ({
          projectName: a.project.name,
          endDate: a.endDate,
        })),
      };
    });
  }

  async getUpcomingFree(days: number = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + days);

    const allocations = await this.prisma.allocation.findMany({
      where: { endDate: { gte: today, lte: future } },
      select: {
        userId: true,
        endDate: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            skills: {
              select: { skill: { select: { name: true } } },
            },
          },
        },
        project: { select: { id: true, name: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    return allocations.map(a => ({
      resource: a.user ? `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim() : null,
      resourceId: a.userId,
      project: a.project.name,
      endDate: a.endDate,
      daysUntilFree: Math.ceil((a.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      skills: a.user?.skills.map(us => us.skill.name) ?? [],
    }));
  }

  private allocationInclude() {
    return {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      freelancer: { select: { id: true, fullName: true, email: true } },
      project: { select: { id: true, name: true } },
    };
  }

  private async prepareAllocation(dto: CreateAllocationDto): Promise<PreparedAllocation> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const resourceType = dto.resourceType ?? ResourceType.EMPLOYEE;
    const isFreelancer = resourceType === ResourceType.FREELANCER;
    const warnings: AllocationWarning[] = [];

    if (start > end) throw new BadRequestException('Start date cannot be after end date');

    if (isFreelancer) {
      if (!dto.freelancerId) throw new BadRequestException('freelancerId is required for FREELANCER allocations');
      await this.freelancersService.canAllocate(dto.freelancerId, start, end);
    } else {
      if (!dto.userId) throw new BadRequestException('userId is required for EMPLOYEE allocations');
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!user || !user.isActive) throw new BadRequestException('User does not exist or is not active');
    }

    if (!isFreelancer && dto.userId) {
      const overlappingLeave = await this.prisma.leave.findFirst({
        where: {
          userId: dto.userId,
          status: 'APPROVED',
          OR: this.overlapWhere(start, end),
        },
      });
      if (overlappingLeave) {
        warnings.push({
          type: 'LEAVE_OVERLAP',
          message: `Resource has approved leave from ${overlappingLeave.startDate.toDateString()} to ${overlappingLeave.endDate.toDateString()}`,
        });
      }

      const projectSkills = await this.prisma.taskSkill.findMany({
        where: { task: { projectId: dto.projectId } },
        select: { skillId: true },
      });
      const requiredSkillIds = [...new Set(projectSkills.map(s => s.skillId))];
      if (requiredSkillIds.length > 0) {
        const userSkillIds = (await this.prisma.userSkill.findMany({ where: { userId: dto.userId } })).map(s => s.skillId);
        const missingSkillIds = requiredSkillIds.filter(id => !userSkillIds.includes(id));
        if (missingSkillIds.length > 0) {
          const missingSkills = await this.prisma.skill.findMany({ where: { id: { in: missingSkillIds } } });
          warnings.push({
            type: 'SKILL_MISMATCH',
            message: `Resource lacks skills: ${missingSkills.map(s => s.name).join(', ')}`,
            missingSkills,
          });
        }
      }
    }

    return {
      data: {
        resourceType,
        projectRole: dto.projectRole,
        startDate: start,
        endDate: end,
        project: { connect: { id: dto.projectId } },
        ...(isFreelancer
          ? { freelancer: { connect: { id: dto.freelancerId! } } }
          : { user: { connect: { id: dto.userId! } } }),
      },
      warnings,
    };
  }

  private overlapWhere(start: Date, end: Date) {
    return [
      { startDate: { lte: start }, endDate: { gte: start } },
      { startDate: { lte: end }, endDate: { gte: end } },
      { startDate: { gte: start }, endDate: { lte: end } },
    ];
  }

}
