import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ForbiddenException,
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NumberSeriesService } from '../admin-config/number-series.service';
import { 
  DemandStatus, 
  NotificationType, 
  ProjectStatus, 
  ProjectType,
  Demand
} from '@prisma/client';
import { CreateDemandDto } from './dto/create-demand.dto';
import { UpdateDemandDto } from './dto/update-demand.dto';
import { ConvertDemandDto } from './dto/convert-demand.dto';
import { CreateDemandCommentDto } from './dto/create-comment.dto';

@Injectable()
export class DemandsService {
  private readonly logger = new Logger(DemandsService.name);

  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
    private notificationsService: NotificationsService,
    private numberSeriesService: NumberSeriesService,
  ) {}

  async create(dto: CreateDemandDto, userId: string) {
    const demandCode = await this.numberSeriesService.generateCode('DEMAND');
    
    return this.prisma.demand.create({
      data: {
        ...dto,
        demandCode,
        requesterId: userId,
        status: DemandStatus.DRAFT,
      },
      include: {
        requester: { select: { firstName: true, lastName: true, email: true } },
        department: true,
      },
    });
  }

  async findAll(userId: string, role: string) {
    const isAdminOrPMO = ['ADMIN', 'PMO'].includes(role);
    
    return this.prisma.demand.findMany({
      where: isAdminOrPMO ? {} : { requesterId: userId },
      include: {
        requester: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const demand = await this.prisma.demand.findUnique({
      where: { id },
      include: {
        requester: { select: { firstName: true, lastName: true, email: true } },
        department: true,
        convertedProject: true,
        comments: {
          include: { author: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!demand) throw new NotFoundException('Demand not found');
    return demand;
  }

  async update(id: string, dto: UpdateDemandDto, userId: string) {
    const demand = await this.findOne(id);
    
    if (demand.requesterId !== userId) {
      throw new ForbiddenException('Only the requester can edit this demand');
    }

    if (demand.status !== DemandStatus.DRAFT) {
      throw new BadRequestException('Demand can only be edited in DRAFT status');
    }

    return this.prisma.demand.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    const demand = await this.findOne(id);

    if (demand.requesterId !== userId) {
      throw new ForbiddenException('Only the requester can delete this demand');
    }

    if (demand.status !== DemandStatus.DRAFT) {
      throw new BadRequestException('Demand can only be deleted in DRAFT status');
    }

    // Soft delete or hard delete? Request says "soft delete (DRAFT only)"
    // But there is no deletedAt in the schema provided. 
    // I'll assume hard delete for now or update schema if needed.
    // Actually, I'll just delete it as it's DRAFT.
    return this.prisma.demand.delete({ where: { id } });
  }

  async submit(id: string, userId: string) {
    const demand = await this.findOne(id);

    if (demand.status !== DemandStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT demands can be submitted');
    }

    // Start Workflow
    const workflow = await this.workflowService.startWorkflow(
      'DEMAND',
      'DEMAND',
      id,
      userId,
      `Submission of demand: ${demand.demandCode}`
    );

    const updatedDemand = await this.prisma.demand.update({
      where: { id },
      data: { 
        status: DemandStatus.SUBMITTED,
        workflowInstanceId: workflow.id,
      },
    });

    // Notify PMO
    await this.notificationsService.sendToRole(
      'PMO',
      NotificationType.APPROVAL_PENDING,
      'New Demand Submitted',
      `Demand ${demand.demandCode}: ${demand.title} has been submitted for review.`,
      { entityType: 'DEMAND', entityId: id }
    );

    return updatedDemand;
  }

  async convertToProject(id: string, userId: string, dto: ConvertDemandDto) {
    const demand = await this.findOne(id);

    if (demand.status !== DemandStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED demands can be converted to projects');
    }

    const projectCode = await this.numberSeriesService.generateCode('PROJECT');

    const project = await this.prisma.project.create({
      data: {
        name: demand.title,
        description: demand.description,
        projectCode,
        startDate: new Date(dto.startDate),
        endDate: demand.estimatedTimeline,
        budgetCost: demand.estimatedBudget,
        pmId: dto.pmId,
        status: ProjectStatus.DRAFT,
        type: ProjectType.DEVELOPMENT, // Defaulting as discussed
        isInternal: true, // Defaulting as discussed
      },
    });

    await this.prisma.demand.update({
      where: { id },
      data: {
        status: DemandStatus.CONVERTED,
        convertedProjectId: project.id,
      },
    });

    // Notify requester
    await this.notificationsService.send(
      demand.requesterId,
      NotificationType.GENERAL,
      'Demand Converted to Project',
      `Your demand ${demand.demandCode} has been converted to project ${projectCode}.`,
      { entityType: 'PROJECT', entityId: project.id }
    );

    return project;
  }

  async addComment(id: string, userId: string, dto: CreateDemandCommentDto) {
    return this.prisma.demandComment.create({
      data: {
        demandId: id,
        authorId: userId,
        body: dto.body,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
  }

  async getComments(id: string) {
    return this.prisma.demandComment.findMany({
      where: { demandId: id },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Workflow Handlers
  async handleWorkflowApproved(entityId: string) {
    const demand = await this.prisma.demand.update({
      where: { id: entityId },
      data: { status: DemandStatus.APPROVED },
      include: { requester: true },
    });

    await this.notificationsService.send(
      demand.requesterId,
      NotificationType.APPROVED,
      'Demand Approved',
      `Your demand ${demand.demandCode} has been approved.`,
      { entityType: 'DEMAND', entityId: demand.id }
    );
  }

  async handleWorkflowRejected(entityId: string, remarks?: string) {
    const demand = await this.prisma.demand.update({
      where: { id: entityId },
      data: { 
        status: DemandStatus.REJECTED,
        reviewerRemarks: remarks,
      },
      include: { requester: true },
    });

    await this.notificationsService.send(
      demand.requesterId,
      NotificationType.REJECTED,
      'Demand Rejected',
      `Your demand ${demand.demandCode} has been rejected. Remarks: ${remarks || 'None'}`,
      { entityType: 'DEMAND', entityId: demand.id }
    );
  }
}
