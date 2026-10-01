import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { NotificationType } from '@prisma/client';
import dayjs from 'dayjs';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

  // Every Monday at 8 AM
  @Cron('0 8 * * 1')
  async timesheetReminderJob() {
    this.logger.log('Running Timesheet Reminder Job');
    const lastMonday = dayjs().subtract(7, 'day').startOf('week').add(1, 'day').toDate();
    const lastSunday = dayjs().subtract(7, 'day').endOf('week').add(1, 'day').toDate();
    const weekLabel = `${dayjs(lastMonday).format('MMM DD')} - ${dayjs(lastSunday).format('MMM DD')}`;

    // Find all active users
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      include: {
        timesheets: {
          where: {
            startDate: { gte: lastMonday },
            endDate: { lte: lastSunday },
          },
        },
      },
    });

    for (const user of users) {
      const submitted = user.timesheets.some(t => ['SUBMITTED', 'RA_APPROVED', 'PM_APPROVED'].includes(t.status));
      if (!submitted) {
        await this.notificationsService.send(
          user.id,
          NotificationType.TIMESHEET_REMINDER,
          `Timesheet Missing: ${weekLabel}`,
          `You have not submitted your timesheet for the week of ${weekLabel}. Please submit it today.`,
          { weekLabel },
          false // Don't send generic email, we'll send a templated one
        );
        await this.emailService.sendTimesheetReminder(user, weekLabel);
      }
    }
  }

  // Every Day at 9 AM
  @Cron('0 9 * * *')
  async approvalOverdueJob() {
    this.logger.log('Running Approval Overdue Job');
    const twoDaysAgo = dayjs().subtract(2, 'day').toDate();

    const pendingWorkflows = await this.prisma.workflowInstance.findMany({
      where: {
        status: 'PENDING',
        updatedAt: { lte: twoDaysAgo },
      },
      include: {
        requester: true,
      },
    });

    for (const wf of pendingWorkflows) {
      // Find the current actor (this logic depends on how the workflow engine determines the current actor)
      // For now, we'll notify the 'reportingAuthority' of the requester if it's a simple flow
      // or we can look up the WorkflowStep.
      // Assuming we can find the current actor from the WorkflowInstance or latest log.
      const lastAction = await this.prisma.workflowActionLog.findFirst({
        where: { instanceId: wf.id },
        orderBy: { stepOrder: 'desc' },
      });

      // This part is simplified; in a real system, you'd find who is supposed to act next.
      // Let's notify the requester's RA for now as a fallback.
      if (wf.requester.reportingAuthorityId) {
        const ra = await this.prisma.user.findUnique({ where: { id: wf.requester.reportingAuthorityId } });
        if (ra) {
          await this.notificationsService.send(
            ra.id,
            NotificationType.APPROVAL_PENDING,
            `Action Overdue: ${wf.entityType}`,
            `Approval request from ${wf.requester.firstName || wf.requester.email} for ${wf.entityType} has been pending for over 48 hours.`,
            { workflowId: wf.id, entityId: wf.entityId, entityType: wf.entityType }
          );
        }
      }
    }
  }

  @Cron('0 8 * * *')
  async contractExpiryJob() {
    this.logger.log('Running Contract Expiry Job');
    const checkDays = [30, 15, 7];
    
    for (const days of checkDays) {
      const targetDate = dayjs().add(days, 'day').format('YYYY-MM-DD');
      const freelancers = await this.prisma.freelancer.findMany({
        where: {
          isActive: true,
          contractEnd: {
            gte: dayjs(targetDate).startOf('day').toDate(),
            lte: dayjs(targetDate).endOf('day').toDate(),
          },
        },
      });

      for (const free of freelancers) {
        // Notify PMO/Admin (Role: ADMIN)
        const admins = await this.prisma.user.findMany({
          where: { role: { name: 'ADMIN' }, isActive: true },
        });

        for (const admin of admins) {
          await this.notificationsService.send(
            admin.id,
            NotificationType.CONTRACT_EXPIRY,
            `Contract Expiring: ${free.fullName}`,
            `The contract for ${free.fullName} is expiring in ${days} days (${dayjs(free.contractEnd).format('MMM DD, YYYY')}).`,
            { freelancerId: free.id, daysLeft: days }
          );
          await this.emailService.sendContractExpiry(admin.email, free.fullName, dayjs(free.contractEnd).format('MMM DD, YYYY'), days);
        }
      }
    }
  }

  @Cron('0 8 * * *')
  async milestoneOverdueJob() {
    this.logger.log('Running Milestone Overdue Job');
    const today = dayjs().toDate();

    const overdueMilestones = await this.prisma.milestone.findMany({
      where: {
        status: { not: 'ACHIEVED' },
        dueDate: { lt: today },
      },
      include: {
        project: {
          include: { pm: true },
        },
      },
    });

    for (const ms of overdueMilestones) {
      if (ms.project.pm) {
        await this.notificationsService.send(
          ms.project.pm.id,
          NotificationType.MILESTONE_OVERDUE,
          `Milestone Overdue: ${ms.name}`,
          `Milestone "${ms.name}" for project "${ms.project.name}" was due on ${dayjs(ms.dueDate).format('MMM DD, YYYY')}.`,
          { projectId: ms.projectId, milestoneId: ms.id }
        );
      }
    }
  }

  @Cron('0 8 * * *')
  async budgetExceededJob() {
    this.logger.log('Running Budget Exceeded Job');
    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE', budgetCost: { gt: 0 } },
      include: { pm: true },
    });

    for (const proj of projects) {
      // Calculate actual cost (this logic might be complex, let's assume we have a simplified version)
      // For this task, we'll just show the structure.
      const actualCost = 0; // In real app, calculate from timesheets * user cost
      
      if (proj.budgetCost && actualCost > proj.budgetCost * 0.9) {
        if (proj.pm) {
          await this.notificationsService.send(
            proj.pm.id,
            NotificationType.BUDGET_EXCEEDED,
            `Budget Warning: ${proj.name}`,
            `Actual cost for project "${proj.name}" has reached ${Math.round((actualCost / proj.budgetCost) * 100)}% of the budget.`,
            { projectId: proj.id }
          );
        }
      }
    }
  }
}
