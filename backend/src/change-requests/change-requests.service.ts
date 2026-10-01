import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';
import { NumberSeriesService } from '../admin-config/number-series.service';
import { WorkflowService } from '../workflow/workflow.service';
import { CRStatus } from '@prisma/client';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class ChangeRequestsService {
  private readonly logger = new Logger(ChangeRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private seriesService: NumberSeriesService,
    private workflowService: WorkflowService,
  ) {}

  async create(dto: CreateChangeRequestDto, user: any) {
    // Robust role detection: check both req.user and the database to be 100% sure
    let roleName = (typeof user.role === 'string' ? user.role : user.role?.name) || '';
    
    // Fail-safe: Fetch from DB if roleName is not one of the auto-approve roles
    if (!['ADMIN', 'PM', 'TL'].includes(roleName.toUpperCase())) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.userId || user.id },
        include: { role: true }
      });
      if (dbUser?.role) {
        roleName = dbUser.role.name;
      }
    }

    try {
      require('fs').writeFileSync('../ROOT_DEBUG_ROLE.txt', `[${new Date().toISOString()}] userId: ${user.userId || user.id}, roleName: ${roleName}\n`);
    } catch (e) {}

    this.logger.log(`Creating CR for user ${user.userId || user.id} -> detected roleName: ${roleName}`);
    
    // All authenticated users can create CRs now, but they will be DRAFT by default
    // unless the user is ADMIN, PM, or TL.

    const crCode = await this.seriesService.generateCode('CR').catch(async () => {
      // If CR series doesn't exist, create it on the fly
      await this.prisma.numberSeries.create({
        data: {
          module: 'CR',
          prefix: 'CR',
          lastSeq: 0,
          padding: 4,
          separator: '-'
        }
      });
      return await this.seriesService.generateCode('CR');
    });

    const { projectId, ...rest } = dto;
    const isAutoApproved = ['ADMIN', 'PM', 'TL'].includes(roleName.toUpperCase());
    this.logger.log(`Is auto-approved: ${isAutoApproved}`);

    const cr = await this.prisma.changeRequest.create({
      data: {
        ...rest,
        project: { connect: { id: projectId } },
        requester: { connect: { id: user.userId } },
        crCode,
        status: isAutoApproved ? CRStatus.APPROVED : CRStatus.DRAFT,
        approvedAt: isAutoApproved ? new Date() : null,
      },
      include: { project: true }
    });

    if (isAutoApproved) {
      this.logger.log(`CR ${cr.crCode} auto-approved for role ${roleName}`);
      await this._applyChangeRequestToProject(cr);
    }

    return cr;
  }

  async findAll(projectId?: string) {
    const where = projectId ? { projectId } : {};
    return this.prisma.changeRequest.findMany({
      where,
      include: {
        project: { select: { name: true, projectCode: true } },
        requester: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const cr = await this.prisma.changeRequest.findUnique({
      where: { id },
      include: {
        project: true,
        requester: { select: { firstName: true, lastName: true } },
        comments: {
          include: { author: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' }
        },
        tasks: {
          select: { id: true, title: true, status: true, phase: true, progressPct: true, estimatedEffort: true, actualEffort: true, assignee: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      } as any, // tasks relation added in migration; TS server cache may need refresh
    });
    if (!cr) throw new NotFoundException('Change Request not found');
    return cr;
  }

  async close(id: string, userId: string) {
    const cr = await this.findOne(id);
    if (!['APPROVED', 'IN_PROGRESS'].includes(cr.status)) {
      throw new BadRequestException('Only APPROVED or IN_PROGRESS change requests can be closed');
    }
    return this.prisma.changeRequest.update({
      where: { id },
      data: { status: 'CLOSED' as any }, // IN_PROGRESS/CLOSED added in migration; remove cast after TS server refresh
    });
  }

  async update(id: string, dto: UpdateChangeRequestDto, userId: string) {
    const cr = await this.findOne(id);
    
    // Check if user is privileged
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { name: true } } }
    });
    const isPrivileged = ['ADMIN', 'PM', 'TL'].includes(user?.role?.name || '');

    if (!isPrivileged && cr.status !== CRStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT change requests can be updated');
    }
    
    // If status is being updated to APPROVED manually by a privileged user, set approvedAt
    const data: any = { ...dto };
    if (isPrivileged && dto.status === CRStatus.APPROVED && cr.status !== CRStatus.APPROVED) {
      data.approvedAt = new Date();
    }

    return this.prisma.changeRequest.update({
      where: { id },
      data,
    });
  }

  async submit(id: string, userId: string) {
    const cr = await this.findOne(id);
    if (cr.status !== CRStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT change requests can be submitted');
    }

    // Set to SUBMITTED
    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: { status: CRStatus.SUBMITTED },
    });

    // Start Workflow
    const workflow = await this.workflowService.startWorkflow(
      'CR',
      'CR',
      cr.id,
      userId,
      `Submitted CR ${cr.crCode}`
    );

    await this.prisma.changeRequest.update({
      where: { id },
      data: { workflowInstanceId: workflow.id },
    });

    return updated;
  }

  async addComment(id: string, authorId: string, body: string) {
    return this.prisma.cRComment.create({
      data: {
        crId: id,
        authorId,
        body,
      },
      include: {
        author: { select: { firstName: true, lastName: true, avatarUrl: true } }
      }
    });
  }

  @OnEvent('workflow.approved')
  async handleWorkflowApproved(payload: any) {
    if (payload.module !== 'CR') return;

    this.logger.log(`CR Workflow Approved for ${payload.entityId}`);
    
    const cr = await this.prisma.changeRequest.findUnique({
      where: { id: payload.entityId },
      include: { project: true }
    });

    if (!cr) return;

    await this.prisma.changeRequest.update({
      where: { id: cr.id },
      data: { status: CRStatus.APPROVED, approvedAt: new Date() }
    });

    await this._applyChangeRequestToProject(cr);
  }

  private async _applyChangeRequestToProject(cr: any) {
    const projectUpdates: any = {};
    if (cr.budgetDelta) {
      projectUpdates.budgetCost = (cr.project.budgetCost || 0) + cr.budgetDelta;
    }
    
    if (cr.timelineDeltaDays && cr.project.endDate) {
      const newEndDate = new Date(cr.project.endDate);
      newEndDate.setDate(newEndDate.getDate() + cr.timelineDeltaDays);
      projectUpdates.endDate = newEndDate;
    } else if (cr.timelineDeltaDays && !cr.project.endDate) {
      const newEndDate = new Date(cr.project.startDate);
      newEndDate.setDate(newEndDate.getDate() + cr.timelineDeltaDays);
      projectUpdates.endDate = newEndDate;
    }

    if (Object.keys(projectUpdates).length > 0) {
      const updatedProject = await this.prisma.project.update({
        where: { id: cr.projectId },
        data: projectUpdates
      });

      let forecastedMargin: number | null = null;
      if (cr.budgetDelta && updatedProject.revenue) {
         forecastedMargin = ((updatedProject.revenue - (updatedProject.budgetCost || 0)) / updatedProject.revenue) * 100;
      }

      await this.prisma.auditLog.create({
        data: {
          action: 'PROJECT_UPDATED_BY_CR',
          module: 'PROJECT',
          userId: cr.requesterId,
          details: {
            crId: cr.id,
            crCode: cr.crCode,
            updates: projectUpdates,
            forecastedMargin
          }
        }
      }).catch(() => {});
    }
  }

  @OnEvent('workflow.rejected')
  async handleWorkflowRejected(payload: any) {
    if (payload.module !== 'CR') return;

    this.logger.log(`CR Workflow Rejected for ${payload.entityId}`);
    
    await this.prisma.changeRequest.update({
      where: { id: payload.entityId },
      data: { status: CRStatus.REJECTED }
    });
    
    // We would notify requester here
  }
}
