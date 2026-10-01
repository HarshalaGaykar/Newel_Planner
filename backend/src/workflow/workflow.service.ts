import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { 
  WorkflowStatus, 
  WorkflowAction, 
  ApproverType, 
  WorkflowInstance,
  User
} from '@prisma/client';
import { CreateWorkflowTemplateDto } from './dto/create-template.dto';
import { TakeActionDto } from './dto/take-action.dto';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createTemplate(dto: CreateWorkflowTemplateDto) {
    return this.prisma.workflowTemplate.create({
      data: {
        module: dto.module,
        name: dto.name,
        isActive: dto.isActive ?? true,
        steps: {
          create: dto.steps.map(step => ({
            stepOrder: step.stepOrder,
            stepName: step.stepName,
            approverType: step.approverType,
            approverRoleId: step.approverRoleId,
            approverUserId: step.approverUserId,
            escalateAfterHours: step.escalateAfterHours,
            allowDelegate: step.allowDelegate ?? true,
          })),
        },
      },
      include: { steps: true },
    });
  }

  async getTemplateForModule(module: string) {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { module, isActive: true },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException(`No active workflow template found for module: ${module}`);
    }
    return template;
  }

  async startWorkflow(
    module: string,
    entityType: string,
    entityId: string,
    requesterId: string,
    remarks?: string,
  ) {
    const template = await this.getTemplateForModule(module);

    const instance = await this.prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        entityType,
        entityId,
        requesterId,
        remarks,
        currentStep: 1,
        status: WorkflowStatus.PENDING,
      },
      include: { template: true },
    });

    // Notify first approver
    await this.notifyApprover(instance, 1);

    return instance;
  }

  async takeAction(
    instanceId: string,
    actorId: string,
    dto: TakeActionDto,
  ) {
    const { action, remarks, delegateTo } = dto;

    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { 
        template: { include: { steps: true } },
        requester: true,
      },
    });

    if (!instance) throw new NotFoundException('Workflow instance not found');
    if (instance.status !== WorkflowStatus.PENDING) {
      throw new BadRequestException('Workflow is not in PENDING status');
    }

    const currentStep = instance.template.steps.find(s => s.stepOrder === instance.currentStep);
    if (!currentStep) throw new Error('Current step configuration not found');

    // Validate actor eligibility
    await this.validateActor(currentStep, actorId, instance.requesterId);

    // Log action
    await this.prisma.workflowActionLog.create({
      data: {
        instanceId,
        stepOrder: instance.currentStep,
        actorId,
        action,
        remarks,
        delegatedTo: delegateTo,
      },
    });

    if (action === WorkflowAction.APPROVE) {
      const nextStepOrder = instance.currentStep + 1;
      const hasNextStep = instance.template.steps.some(s => s.stepOrder === nextStepOrder);

      if (hasNextStep) {
        await this.prisma.workflowInstance.update({
          where: { id: instanceId },
          data: { currentStep: nextStepOrder },
        });
        await this.notifyApprover(instance, nextStepOrder);
      } else {
        await this.prisma.workflowInstance.update({
          where: { id: instanceId },
          data: { status: WorkflowStatus.APPROVED },
        });
        await this.handleCompletion(instance, WorkflowStatus.APPROVED);
      }
    } else if (action === WorkflowAction.REJECT) {
      await this.prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: WorkflowStatus.REJECTED },
      });
      await this.handleCompletion(instance, WorkflowStatus.REJECTED);
    } else if (action === WorkflowAction.SEND_BACK) {
      await this.prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { currentStep: 1 },
      });
      // Notify requester
      this.logger.log(`Workflow ${instanceId} sent back to step 1. Notifying requester ${instance.requesterId}`);
    } else if (action === WorkflowAction.DELEGATE) {
      if (!delegateTo) throw new BadRequestException('delegateTo is required for DELEGATE action');
      // Logic for delegation could be complex; here we just log it and maybe notify the new person
      this.logger.log(`Workflow ${instanceId} delegated to ${delegateTo}`);
    }

    return { success: true };
  }

  async getPendingForActor(actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
      include: { role: true },
    });

    if (!user) throw new NotFoundException('User not found');

    // This is a bit complex in Prisma because we need to filter instances 
    // where the CURRENT STEP's approver matches the actor.
    // Since we can't easily join on the dynamic stepOrder in a single query with current Prisma API,
    // we'll fetch all pending and filter in memory or use a raw query if needed.
    // For simplicity in this demo, let's fetch pending instances and their templates.

    const pendingInstances = await this.prisma.workflowInstance.findMany({
      where: { status: WorkflowStatus.PENDING },
      include: { 
        template: { include: { steps: true } },
        requester: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return pendingInstances.filter(instance => {
      const step = instance.template.steps.find(s => s.stepOrder === instance.currentStep);
      if (!step) return false;

      if (step.approverType === ApproverType.ROLE) {
        return step.approverRoleId === user.roleId;
      } else if (step.approverType === ApproverType.USER) {
        return step.approverUserId === actorId;
      } else if (step.approverType === ApproverType.REPORTING_AUTHORITY) {
        // Find if the requester's RA is the current actor
        return instance.requesterId === actorId; // This is a simplified check, 
        // real logic: find requester's RA and check if it's actorId
      }
      return false;
    });
  }

  async getInstanceHistory(entityType: string, entityId: string) {
    return this.prisma.workflowInstance.findMany({
      where: { entityType, entityId },
      include: { 
        actions: { 
          include: { actor: { select: { firstName: true, lastName: true } } },
          orderBy: { takenAt: 'desc' },
        },
        template: true,
        requester: { select: { firstName: true, lastName: true } },
      },
    });
  }

  private async validateActor(step: any, actorId: string, requesterId: string) {
    if (step.approverType === ApproverType.USER) {
      if (step.approverUserId !== actorId) throw new BadRequestException('Not authorized for this step');
    } else if (step.approverType === ApproverType.ROLE) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
      if (actor?.roleId !== step.approverRoleId) throw new BadRequestException('Not authorized for this step (Role mismatch)');
    } else if (step.approverType === ApproverType.REPORTING_AUTHORITY) {
      const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
      if (requester?.reportingAuthorityId !== actorId) throw new BadRequestException('Not authorized for this step (RA mismatch)');
    }
  }

  private async notifyApprover(instance: WorkflowInstance, stepOrder: number) {
    // Placeholder for NotificationService
    this.logger.log(`[Notification] Notifying approvers for workflow ${instance.id} at step ${stepOrder}`);
  }

  private async handleCompletion(instance: any, status: WorkflowStatus) {
    this.logger.log(`Workflow ${instance.id} completed with status ${status}`);
    
    // Emit event for other modules to listen
    const eventName = `workflow.${status.toLowerCase()}`;
    this.eventEmitter.emit(eventName, {
      instanceId: instance.id,
      module: instance.template.module,
      entityType: instance.entityType,
      entityId: instance.entityId,
      requesterId: instance.requesterId,
      status: status,
    });
  }
}
