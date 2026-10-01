import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ProjectStatus, NotificationType, ProjectType } from '@prisma/client';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NumberSeriesService } from '../admin-config/number-series.service';
import { NotificationsService } from '../notifications/notifications.service';

// Valid status transitions: key = current status, value = allowed next statuses
const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: [ProjectStatus.APPROVED, ProjectStatus.CANCELLED],
  APPROVED: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED, ProjectStatus.INACTIVE],
  ACTIVE: [ProjectStatus.ON_HOLD, ProjectStatus.CLOSED, ProjectStatus.CANCELLED, ProjectStatus.INACTIVE],
  ON_HOLD: [ProjectStatus.ACTIVE, ProjectStatus.CLOSED, ProjectStatus.CANCELLED],
  CLOSED: [ProjectStatus.ARCHIVED, ProjectStatus.CANCELLED],
  ARCHIVED: [ProjectStatus.CANCELLED],
  CANCELLED: [],
  // Dormant projects are auto-set to INACTIVE by ProjectDormancyCron and auto-reactivated
  // to ACTIVE when a timesheet entry is logged again (see systemTransition).
  INACTIVE: [ProjectStatus.ACTIVE],
};

// Transitions that require ADMIN role
const ADMIN_ONLY_TRANSITIONS: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  DRAFT: [ProjectStatus.APPROVED],
};

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private seriesService: NumberSeriesService,
    private notificationsService: NotificationsService,
  ) { }

  private readonly projectInclude = {
    client: { select: { id: true, clientCode: true, name: true } },
    pm: { select: { id: true, firstName: true, lastName: true } },
    currency: { select: { id: true, code: true, symbol: true } },
    profitCenter: { select: { id: true, code: true, name: true } },
  };

  async create(dto: CreateProjectDto, user: { id: string; role: string }) {
    if (!['ADMIN', 'PM', 'TL'].includes(user.role)) {
      // Reporting Authorities (users who have at least one active direct report)
      // are also allowed to create projects, even without the PM/TL/Admin role.
      const subordinateCount = await this.prisma.user.count({
        where: { reportingAuthorityId: user.id, isActive: true },
      });
      if (subordinateCount === 0) {
        throw new ForbiddenException(
          'Only PMs, TLs, Admins, and Reporting Authorities can create projects',
        );
      }
    }

    const projectCode = dto.projectCode || (await this.seriesService.generateCode('PROJECT'));

    return this.prisma.project.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...dto,
        createdById: user.id,
        projectCode,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      } as any,
      include: this.projectInclude,
    });
  }


  async findAll(
    user: { id: string; role: string },
    filters?: { status?: string; type?: string; clientId?: string; search?: string },
  ) {
    const where: any = {};

    if (user.role !== 'ADMIN') {
      // Non-admins see projects they manage (pmId), created (createdById),
      // or are allocated to ("involved in"). ADMIN sees all (no filter).
      where.OR = [
        { pmId: user.id },
        { createdById: user.id },
        { allocations: { some: { userId: user.id } } },
      ];
    }

    // Apply enum filters only when the value is a valid member; silently ignore
    // unknown values (e.g. a stale 'INACTIVE') rather than erroring.
    if (filters?.status && Object.values(ProjectStatus).includes(filters.status as ProjectStatus)) {
      where.status = filters.status;
    }
    if (filters?.type && Object.values(ProjectType).includes(filters.type as ProjectType)) {
      where.type = filters.type;
    }
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    return this.prisma.project.findMany({
      where,
      include: {
        ...this.projectInclude,
        _count: { select: { tasks: true, tickets: true } },
        allocations: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        milestones: true,
      },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { id },
          { projectCode: { equals: id, mode: 'insensitive' } }
        ]
      },
      include: {
        ...this.projectInclude,
        tasks: true,
        tickets: true,
        milestones: true,
        allocations: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!project) throw new NotFoundException(`Project with ID ${id} not found`);
    return project;
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    user: { id: string; role: string },
  ) {
    const project = await this.findOne(id);

    if (dto.status && dto.status !== project.status) {
      const from = project.status as ProjectStatus;
      const to = dto.status as ProjectStatus;

      const allowed = STATUS_TRANSITIONS[from] ?? [];
      if (!allowed.includes(to)) {
        throw new BadRequestException(
          `Cannot transition project from ${from} to ${to}`,
        );
      }

      const adminOnly = ADMIN_ONLY_TRANSITIONS[from] ?? [];
      if (adminOnly.includes(to) && user.role !== 'ADMIN') {
        throw new ForbiddenException(
          `Only ADMIN can transition project from ${from} to ${to}`,
        );
      }

      if (to === ProjectStatus.CANCELLED && user.role !== 'ADMIN') {
        throw new ForbiddenException('Only ADMIN can cancel a project');
      }

      await this.prisma.auditLog.create({
        data: {
          action: 'STATUS_TRANSITION',
          module: 'PROJECT',
          userId: user.id,
          details: { projectId: id, from, to },
        },
      });
    }

    return this.prisma.project.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      } as any,
      include: this.projectInclude,
    });
  }

  /**
   * System-initiated project status change, shared by ProjectDormancyCron (auto-inactivate)
   * and the timesheet reactivation hook (auto-reactivate). Respects the STATUS_TRANSITIONS
   * graph so a CLOSED/CANCELLED project is never silently flipped, but bypasses the human
   * role checks in update(). `actorId` is null for the cron and the acting user's id for
   * reactivation. Returns true if a transition occurred, false if it was a no-op/not allowed.
   */
  async systemTransition(
    projectId: string,
    to: ProjectStatus,
    opts: { actorId: string | null; reason: string; notifyPm: boolean },
  ): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true, pmId: true },
    });
    if (!project) return false;

    const from = project.status;
    if (from === to) return false;
    if (!(STATUS_TRANSITIONS[from] ?? []).includes(to)) return false;

    await this.prisma.project.update({ where: { id: projectId }, data: { status: to } });

    await this.prisma.auditLog
      .create({
        data: {
          action: to === ProjectStatus.INACTIVE ? 'AUTO_INACTIVATE' : 'AUTO_REACTIVATE',
          module: 'PROJECT',
          entityId: projectId,
          userId: opts.actorId,
          details: { from, to, reason: opts.reason },
        },
      })
      .catch(() => {});

    if (opts.notifyPm && project.pmId) {
      await this.notificationsService
        .send(
          project.pmId,
          NotificationType.PROJECT_DORMANT,
          `Project marked inactive: ${project.name}`,
          `"${project.name}" was automatically marked inactive. Reason: ${opts.reason}. Logging a timesheet against it will reactivate it.`,
          { projectId, entityType: 'PROJECT', link: `/projects/${projectId}` },
        )
        .catch(() => {});
    }

    return true;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }

  async getBurnRate(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { budgetCost: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const entries = await this.prisma.timesheetEntry.findMany({
      where: { projectId, timesheet: { status: 'PM_APPROVED' as any } },
      include: {
        timesheet: { include: { user: { select: { baseCostPerHour: true } } } },
      },
    });

    const actualCost = entries.reduce((sum, entry) => {
      return sum + entry.hours * (entry.timesheet.user?.baseCostPerHour ?? 0);
    }, 0);

    const budgetCost = project.budgetCost ?? 0;
    const burnRatePct = budgetCost > 0 ? (actualCost / budgetCost) * 100 : 0;

    return { budgetCost, actualCost, burnRatePct: Math.round(burnRatePct * 100) / 100 };
  }

  async getMargin(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { revenue: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const { actualCost } = await this.getBurnRate(projectId);
    const revenue = project.revenue ?? 0;
    const margin = revenue > 0 ? ((revenue - actualCost) / revenue) * 100 : 0;

    return { revenue, actualCost, margin: Math.round(margin * 100) / 100 };
  }
}
