import {
  Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { EmailKind, EmailLogStatus } from '@prisma/client';
import { CreateLeafDto } from './dto/create-leaf.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeResolverService } from '../common/scope-resolver.service';
import { ExportService } from '../reports/export.service';
import { EmailService } from '../notifications/email.service';
import { EmailLogService } from '../notifications/email-log.service';

type LeaveApprovalStep = 'RA';
type LeaveForApproval = {
  userId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  raStatus: string;
  pmStatus: string;
  hrStatus: string;
  user: { reportingAuthorityId: string | null };
};

/**
 * Leave day counts are floats — a half-day is 0.5 — so summing them surfaces IEEE
 * noise like 20.999999999999996. Round to 2dp as the number leaves the service:
 * half-day precision survives, the noise does not.
 */
const roundDays = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    private prisma: PrismaService,
    private scopeResolver: ScopeResolverService,
    private exportService: ExportService,
    private emailService: EmailService,
    private emailLog: EmailLogService,
  ) {}

  // ── Approval mail thread ─────────────────────────────────────────────────────
  // Every send here runs AFTER its transaction has committed. An SMTP call inside
  // an interactive transaction would hold a pooled connection for the whole
  // network round trip, and this database has already hit pool exhaustion.

  private displayName(user: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Unknown user';
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(value);
  }

  private formatDateTime(value: Date) {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
  }

  private dateRangeLabel(leave: { startDate: Date; endDate: Date }) {
    const start = this.formatDate(leave.startDate);
    const end = this.formatDate(leave.endDate);
    return start === end ? start : `${start} – ${end}`;
  }

  private durationLabel(leave: {
    duration: number;
    sandwichDays: number;
    isHalfDay: boolean;
    halfDaySession?: string | null;
  }) {
    if (leave.isHalfDay) {
      return `Half day${leave.halfDaySession ? ` (${leave.halfDaySession.toLowerCase()})` : ''}`;
    }
    const total = (leave.duration ?? 0) + (leave.sandwichDays ?? 0);
    return `${total} day${total === 1 ? '' : 's'}`;
  }

  /** Loads everything both mails need in one query. */
  private loadLeaveForMail(id: string) {
    return this.prisma.leave.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true, employeeCode: true,
            department: { select: { name: true } },
            reportingAuthority: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        approver: { select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } } },
      },
    });
  }

  private async leaveTypeName(code: string | null) {
    if (!code) return { name: 'Leave', isPaid: false };
    const type = await this.prisma.leaveTypeMaster.findUnique({
      where: { code },
      select: { name: true, isPaid: true },
    });
    return { name: type?.name ?? code, isPaid: type?.isPaid ?? false };
  }

  /**
   * Mails the reporting authority that a leave needs their decision, CC'ing the
   * requester so the decision reply threads for both. Never throws — a mail
   * problem must not undo an applied leave.
   */
  private async sendLeaveRequestMail(leaveId: string) {
    const leave = await this.loadLeaveForMail(leaveId);
    if (!leave) return;

    const approver = leave.user.reportingAuthority;
    if (!approver?.email) {
      this.logger.warn(
        `Leave ${leave.id}: ${leave.user.email} has no reporting authority with an email — ` +
          'no request mail sent (an ADMIN can still approve it)',
      );
      return;
    }

    const { name: leaveTypeName, isPaid } = await this.leaveTypeName(leave.leaveTypeCode);
    const employeeName = this.displayName(leave.user);
    const dateRange = this.dateRangeLabel(leave);
    const subject = this.emailService.leaveSubject(employeeName, leaveTypeName, dateRange);

    // Balance is already deducted at creation, so this is the post-request figure.
    let balanceLabel = 'Not tracked for this leave type';
    if (leave.leaveTypeCode && isPaid) {
      const balance = await this.prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeCode: { userId: leave.userId, leaveTypeCode: leave.leaveTypeCode },
        },
        select: { earnedBalance: true, usedBalance: true },
      });
      if (balance) {
        const remaining = (balance.earnedBalance ?? 0) - (balance.usedBalance ?? 0);
        balanceLabel = `${remaining} of ${balance.earnedBalance ?? 0} day(s) remaining`;
      }
    }

    try {
      const info = await this.emailService.sendLeaveRequest(
        approver.email,
        {
          leaveId: leave.id,
          approverName: approver.firstName || approver.email,
          employeeName,
          employeeCode: leave.user.employeeCode,
          department: leave.user.department?.name ?? null,
          leaveTypeName,
          isPaid,
          dateRange,
          durationLabel: this.durationLabel(leave),
          sandwichDays: leave.sandwichDays ?? 0,
          reason: leave.reason,
          balanceLabel,
          appliedAt: this.formatDateTime(leave.createdAt),
        },
        leave.user.email ?? undefined,
      );

      await this.prisma.leave.update({
        where: { id: leave.id },
        data: {
          requestMailMessageId:
            (info as any)?.messageId ?? this.emailService.leaveMessageId(leave.id),
          requestMailSentAt: new Date(),
        },
      });

      await this.emailLog.record({
        kind: EmailKind.LEAVE_REQUEST,
        status: EmailLogStatus.SUCCESS,
        recipient: approver.email,
        subject,
        templateName: 'leave-request',
        messageId: (info as any)?.messageId ?? null,
        subjectUserId: leave.userId,
        dedupeKey: `leave:${leave.id}:request`,
        metadata: { cc: leave.user.email },
      });

      this.logger.log(`Leave ${leave.id}: request mail sent to ${approver.email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Leave ${leave.id}: request mail to ${approver.email} failed — ${message}`);
      await this.emailLog.record({
        kind: EmailKind.LEAVE_REQUEST,
        status: EmailLogStatus.FAILED,
        recipient: approver.email,
        subject,
        templateName: 'leave-request',
        error: message,
        subjectUserId: leave.userId,
      });
    }
  }

  /**
   * Replies to the request thread with the outcome. Sent on every decision — an
   * ADMIN may decide in place of the reporting authority, and the requester still
   * needs to know. The RA is CC'd so they see a decision made over their head.
   */
  private async sendLeaveDecisionMail(leaveId: string, approved: boolean, balanceRefunded: boolean) {
    const leave = await this.loadLeaveForMail(leaveId);
    if (!leave) return;

    if (!leave.user.email) {
      this.logger.warn(`Leave ${leave.id}: requester has no email — decision mail skipped`);
      return;
    }

    const { name: leaveTypeName } = await this.leaveTypeName(leave.leaveTypeCode);
    const employeeName = this.displayName(leave.user);
    const dateRange = this.dateRangeLabel(leave);
    const subject = `Re: ${this.emailService.leaveSubject(employeeName, leaveTypeName, dateRange)}`;

    // Name the decider's role only when it wasn't the requester's own RA, so an
    // approval that bypassed the chain is visible rather than silent.
    const decidedByRa =
      leave.approver?.id && leave.approver.id === leave.user.reportingAuthority?.id;
    const approverRole = decidedByRa ? null : leave.approver?.role?.name ?? null;

    try {
      const info = await this.emailService.sendLeaveDecision(
        leave.user.email,
        {
          approved,
          employeeName,
          approverName: leave.approver ? this.displayName(leave.approver) : 'Approver',
          approverRole,
          leaveTypeName,
          dateRange,
          durationLabel: this.durationLabel(leave),
          decidedAt: this.formatDateTime(leave.decidedAt ?? new Date()),
          decisionRemarks: leave.decisionRemarks,
          reason: leave.reason,
          balanceRefunded,
          inReplyTo: leave.requestMailMessageId ?? this.emailService.leaveMessageId(leave.id),
        },
        leave.user.reportingAuthority?.email ?? undefined,
      );

      await this.emailLog.record({
        kind: EmailKind.LEAVE_DECISION,
        status: EmailLogStatus.SUCCESS,
        recipient: leave.user.email,
        subject,
        templateName: 'leave-decision',
        messageId: (info as any)?.messageId ?? null,
        subjectUserId: leave.userId,
        dedupeKey: `leave:${leave.id}:decision`,
        metadata: {
          outcome: approved ? 'APPROVED' : 'REJECTED',
          cc: leave.user.reportingAuthority?.email ?? null,
          decidedByRa: Boolean(decidedByRa),
        },
      });

      this.logger.log(
        `Leave ${leave.id}: ${approved ? 'approval' : 'rejection'} mail sent to ${leave.user.email}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Leave ${leave.id}: decision mail to ${leave.user.email} failed — ${message}`);
      await this.emailLog.record({
        kind: EmailKind.LEAVE_DECISION,
        status: EmailLogStatus.FAILED,
        recipient: leave.user.email,
        subject,
        templateName: 'leave-decision',
        error: message,
        subjectUserId: leave.userId,
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async getHolidaySet(from: Date, to: Date, locationId?: string | null): Promise<Set<string>> {
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        date: { gte: from, lte: to },
        OR: [
          { isGlobal: true },
          ...(locationId ? [{ locationId }] : []),
        ],
      },
    });
    return new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
  }

  private async countWorkingDays(start: Date, end: Date, locationId?: string | null): Promise<number> {
    const holidayDates = await this.getHolidaySet(start, end, locationId);
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      const ds = cur.toISOString().split('T')[0];
      if (dow !== 0 && dow !== 6 && !holidayDates.has(ds)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  private isNonWorkingDay(date: Date, holidayDates: Set<string>): boolean {
    const dow = date.getDay();
    return dow === 0 || dow === 6 || holidayDates.has(date.toISOString().split('T')[0]);
  }

  // ── Balance ───────────────────────────────────────────────────────────────────

  async getBalance(userId: string, leaveTypeCode: string) {
    const bal = await this.prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeCode: { userId, leaveTypeCode } },
    });
    if (!bal) return { earned: 0, used: 0, carryForward: 0, available: 0, expiryDate: null };
    const available = bal.earnedBalance + bal.carryForward - bal.usedBalance;
    return {
      earned: roundDays(bal.earnedBalance),
      used: roundDays(bal.usedBalance),
      carryForward: roundDays(bal.carryForward),
      available: roundDays(available),
      expiryDate: bal.expiryDate,
    };
  }

  async getBalancesForUser(userId: string) {
    const [balances, leaveTypes] = await Promise.all([
      this.prisma.leaveBalance.findMany({ where: { userId } }),
      this.prisma.leaveTypeMaster.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    ]);
    const balanceMap = new Map(balances.map(b => [b.leaveTypeCode, b]));

    // Return every active leave type, even those with no balance record yet (shown as 0)
    return leaveTypes.map(lt => {
      const b = balanceMap.get(lt.code);
      return {
        id: b?.id ?? `${userId}-${lt.code}`,
        leaveTypeCode: lt.code,
        type: lt.name,
        isPaid: lt.isPaid,
        earned: roundDays(b?.earnedBalance ?? 0),
        used: roundDays(b?.usedBalance ?? 0),
        carryForward: roundDays(b?.carryForward ?? 0),
        available: roundDays((b?.earnedBalance ?? 0) + (b?.carryForward ?? 0) - (b?.usedBalance ?? 0)),
        expiryDate: b?.expiryDate ?? null,
        financialYearId: b?.financialYearId ?? null,
      };
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async create(createLeafDto: CreateLeafDto) {
    const start = new Date(createLeafDto.startDate);
    const end = new Date(createLeafDto.endDate);

    if (start > end) throw new BadRequestException('Start date cannot be after end date');

    const leaveType = await this.prisma.leaveTypeMaster.findUnique({
      where: { code: createLeafDto.leaveTypeCode },
    });
    if (!leaveType || !leaveType.isActive) {
      throw new BadRequestException(`Leave type "${createLeafDto.leaveTypeCode}" is invalid or inactive`);
    }

    if (createLeafDto.isHalfDay && !leaveType.allowHalfDay) {
      throw new BadRequestException(`Leave type "${leaveType.name}" does not allow half-day`);
    }
    if (createLeafDto.isHalfDay && !createLeafDto.halfDaySession) {
      throw new BadRequestException('halfDaySession (MORNING/AFTERNOON) is required for half-day leave');
    }

    const overlap = await this.prisma.leave.findFirst({
      where: {
        userId: createLeafDto.userId,
        status: { not: 'REJECTED' },
        OR: [
          { startDate: { lte: start }, endDate: { gte: start } },
          { startDate: { lte: end }, endDate: { gte: end } },
          { startDate: { gte: start }, endDate: { lte: end } },
        ],
      },
    });
    if (overlap) throw new BadRequestException('User already has a leave applied for this period');

    const user = await this.prisma.user.findUnique({
      where: { id: createLeafDto.userId },
      select: { locationId: true },
    });

    let duration: number;
    let sandwichDays = 0;

    if (createLeafDto.isHalfDay) {
      duration = 0.5;
    } else {
      duration = await this.countWorkingDays(start, end, user?.locationId);

      if (leaveType.requiresSandwichCheck && duration > 0) {
        const windowStart = new Date(start); windowStart.setDate(windowStart.getDate() - 7);
        const windowEnd = new Date(end); windowEnd.setDate(windowEnd.getDate() + 7);
        const holidayDates = await this.getHolidaySet(windowStart, windowEnd, user?.locationId);

        const dayBefore = new Date(start); dayBefore.setDate(dayBefore.getDate() - 1);
        const dayAfter = new Date(end); dayAfter.setDate(dayAfter.getDate() + 1);

        if (this.isNonWorkingDay(dayBefore, holidayDates) && this.isNonWorkingDay(dayAfter, holidayDates)) {
          // Count the sandwich non-working span on each side
          let extra = 0;
          let d = new Date(dayBefore);
          while (this.isNonWorkingDay(d, holidayDates)) {
            extra++;
            d.setDate(d.getDate() - 1);
          }
          d = new Date(dayAfter);
          while (this.isNonWorkingDay(d, holidayDates)) {
            extra++;
            d.setDate(d.getDate() + 1);
          }
          sandwichDays = extra;
        }
      }
    }

    const totalDays = duration + sandwichDays;

    if (leaveType.isPaid) {
      const balance = await this.getBalance(createLeafDto.userId, createLeafDto.leaveTypeCode);
      if (balance.available < totalDays) {
        throw new BadRequestException(
          `Insufficient ${leaveType.name} balance. Required: ${totalDays}, Available: ${balance.available}`,
        );
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const leave = await tx.leave.create({
        data: {
          userId: createLeafDto.userId,
          startDate: start,
          endDate: end,
          leaveTypeCode: createLeafDto.leaveTypeCode,
          isHalfDay: createLeafDto.isHalfDay ?? false,
          halfDaySession: createLeafDto.halfDaySession,
          sandwichDays,
          duration,
          reason: createLeafDto.reason,
        },
      });

      if (leaveType.isPaid) {
        await tx.leaveBalance.upsert({
          where: { userId_leaveTypeCode: { userId: createLeafDto.userId, leaveTypeCode: createLeafDto.leaveTypeCode } },
          update: { usedBalance: { increment: totalDays } },
          create: {
            userId: createLeafDto.userId,
            leaveTypeCode: createLeafDto.leaveTypeCode,
            earnedBalance: 0,
            usedBalance: totalDays,
          },
        });
      }

      return leave;
    });

    // Outside the transaction on purpose — see the mail-thread section above.
    await this.sendLeaveRequestMail(created.id);

    return created;
  }

  // ── Approval workflow ─────────────────────────────────────────────────────────

  async getPendingApprovals(actorId: string, actorRole: string) {
    const pendingLeaves = await this.prisma.leave.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            reportingAuthorityId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const actionableLeaves: Array<(typeof pendingLeaves)[number] & { approvalStep: LeaveApprovalStep }> = [];
    for (const leave of pendingLeaves) {
      const approvalStep = await this.getActionableApprovalStep(leave, actorId, actorRole);
      if (approvalStep) actionableLeaves.push({ ...leave, approvalStep });
    }

    return actionableLeaves;
  }

  async raApprove(id: string, approverId: string, approverRole: string, decisionRemarks?: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
      include: { user: { select: { reportingAuthorityId: true } } },
    });
    if (!leave) throw new NotFoundException('Leave not found');
    this.assertLeaveIsPending(leave);
    if (leave.raStatus !== 'PENDING') {
      throw new BadRequestException('Leave has already been reviewed by the reporting authority');
    }
    this.assertCanApproveReportingAuthority(leave, approverId, approverRole);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.leave.update({
        where: { id },
        data: {
          raStatus: 'APPROVED',
          pmStatus: 'NOT_REQUIRED',
          hrStatus: 'NOT_REQUIRED',
          status: 'APPROVED',
          approverId,
          decidedAt: new Date(),
          decisionRemarks: decisionRemarks?.trim() || null,
        },
      });

      await tx.notification.create({
        data: {
          userId: leave.userId,
          type: 'APPROVED',
          title: 'Leave Approved',
          body: `Your leave from ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()} has been approved.`,
          metadata: { entityType: 'LEAVE', entityId: id },
        },
      });

      // Notify PMs of overlapping project allocations
      const allocations = await tx.allocation.findMany({
        where: {
          userId: leave.userId,
          startDate: { lte: leave.endDate },
          endDate: { gte: leave.startDate },
        },
        include: { project: { select: { pmId: true, name: true } } },
      });

      const notifiedPMs = new Set<string>();
      for (const alloc of allocations) {
        const pmId = alloc.project.pmId;
        if (pmId && !notifiedPMs.has(pmId)) {
          notifiedPMs.add(pmId);
          await tx.notification.create({
            data: {
              userId: pmId,
              type: 'GENERAL',
              title: 'Resource on Approved Leave',
              body: `A resource allocated to "${alloc.project.name}" is on approved leave from ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()}.`,
              metadata: { entityType: 'LEAVE', entityId: id, leaveUserId: leave.userId },
            },
          });
        }
      }

      return updated;
    });

    await this.sendLeaveDecisionMail(id, true, false);

    return result;
  }

  async reject(id: string, approverId: string, approverRole: string, decisionRemarks?: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
      include: { user: { select: { reportingAuthorityId: true } } },
    });
    if (!leave) throw new NotFoundException(`Leave with ID ${id} not found`);
    this.assertLeaveIsPending(leave);

    const approvalStep = await this.getActionableApprovalStep(leave, approverId, approverRole);
    if (!approvalStep) {
      throw new ForbiddenException('You are not allowed to reject this leave request');
    }

    const rejectedStepData =
      approvalStep === 'RA'
        ? { raStatus: 'REJECTED' }
        : approvalStep === 'PM'
          ? { pmStatus: 'REJECTED' }
          : { hrStatus: 'REJECTED' };

    const { updated, balanceRefunded } = await this.prisma.$transaction(async (tx) => {
      // Refund balance that was deducted at creation
      let refunded = false;
      if (leave.leaveTypeCode && leave.status !== 'REJECTED') {
        const leaveType = await tx.leaveTypeMaster.findUnique({ where: { code: leave.leaveTypeCode } });
        if (leaveType?.isPaid) {
          const totalDays = (leave.duration ?? 0) + leave.sandwichDays;
          if (totalDays > 0) {
            await tx.leaveBalance.updateMany({
              where: { userId: leave.userId, leaveTypeCode: leave.leaveTypeCode },
              data: { usedBalance: { decrement: totalDays } },
            });
            refunded = true;
          }
        }
      }

      const row = await tx.leave.update({
        where: { id },
        data: {
          status: 'REJECTED',
          ...rejectedStepData,
          approverId,
          decidedAt: new Date(),
          decisionRemarks: decisionRemarks?.trim() || null,
        },
      });

      // Approval already raised an in-app notification; rejection raised none,
      // so the requester was never told inside the app either.
      await tx.notification.create({
        data: {
          userId: leave.userId,
          type: 'REJECTED',
          title: 'Leave Rejected',
          body: `Your leave from ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()} was rejected.`,
          metadata: { entityType: 'LEAVE', entityId: id },
        },
      });

      return { updated: row, balanceRefunded: refunded };
    });

    await this.sendLeaveDecisionMail(id, false, balanceRefunded);

    return updated;
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  private async getActionableApprovalStep(
    leave: LeaveForApproval,
    actorId: string,
    actorRole: string,
  ): Promise<LeaveApprovalStep | null> {
    if (leave.userId === actorId || leave.status !== 'PENDING') return null;
    if (leave.raStatus === 'PENDING') {
      return this.canApproveReportingAuthority(leave, actorId, actorRole) ? 'RA' : null;
    }
    return null;
  }

  private assertLeaveIsPending(leave: { status: string }) {
    if (leave.status !== 'PENDING') {
      throw new BadRequestException('Leave request is no longer pending');
    }
  }

  private assertCanApproveReportingAuthority(
    leave: LeaveForApproval,
    approverId: string,
    approverRole: string,
  ) {
    if (!this.canApproveReportingAuthority(leave, approverId, approverRole)) {
      throw new ForbiddenException(
        'Only the requester reporting authority can approve this leave request',
      );
    }
  }

  private canApproveReportingAuthority(
    leave: LeaveForApproval,
    approverId: string,
    approverRole: string,
  ) {
    if (leave.userId === approverId) return false;
    if (approverRole === 'ADMIN') return true;
    return leave.user.reportingAuthorityId === approverId;
  }


  async findAll(actorId: string, actorRole: string, userId?: string) {
    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_LEAVE_VIEW');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    const where: any = {};
    if (userId) {
      if (userId !== actorId && allowedIds && !allowedIds.includes(userId)) {
        throw new ForbiddenException('You are not allowed to view this user leave records');
      }
      where.userId = userId;
    } else if (allowedIds) {
      where.userId = { in: allowedIds };
    }

    return this.prisma.leave.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.leave.findUnique({
      where: { id },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }

  async remove(id: string) {
    const leave = await this.findOne(id);
    if (!leave) throw new NotFoundException(`Leave with ID ${id} not found`);
    if (leave.status === 'APPROVED') throw new BadRequestException('Cannot delete an approved leave');
    return this.prisma.leave.delete({ where: { id } });
  }

  async getCalendar(actorId: string, actorRole: string, month: number, year: number, departmentId?: string) {
    const allowedIds = await this.resolveCalendarUserIds(actorId, actorRole);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const where: any = {
      status: { not: 'REJECTED' },
      startDate: { lte: end },
      endDate: { gte: start },
      ...(departmentId ? { user: { departmentId } } : {}),
    };

    if (allowedIds) {
      where.userId = { in: allowedIds };
    }

    return this.prisma.leave.findMany({
      where,
      select: {
        id: true,
        userId: true,
        startDate: true,
        endDate: true,
        leaveTypeCode: true,
        status: true,
        duration: true,
        isHalfDay: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  // ── Scheduler-triggered operations ───────────────────────────────────────────

  private async resolveCalendarUserIds(actorId: string, actorRole: string) {
    if (['ADMIN', 'HR'].includes(actorRole)) {
      return null;
    }

    const directReports = await this.prisma.user.findMany({
      where: { reportingAuthorityId: actorId, isActive: true },
      select: { id: true },
    });

    if (directReports.length > 0) {
      return directReports.map((user) => user.id);
    }

    return [actorId];
  }

  async checkExpiry() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredBalances = await this.prisma.leaveBalance.findMany({
      where: { expiryDate: { lt: today } },
    });

    let processed = 0;
    for (const bal of expiredBalances) {
      const available = bal.earnedBalance + bal.carryForward - bal.usedBalance;
      if (available > 0) {
        await this.prisma.$transaction([
          this.prisma.leaveBalance.update({
            where: { id: bal.id },
            // Collapse earned+carry into used so available = 0
            data: { earnedBalance: bal.usedBalance, carryForward: 0 },
          }),
          this.prisma.notification.create({
            data: {
              userId: bal.userId,
              type: 'LEAVE_BALANCE_LOW',
              title: 'Leave Balance Expired',
              body: `${available} leave day(s) for "${bal.leaveTypeCode}" have expired.`,
              metadata: { entityType: 'LEAVE_BALANCE', entityId: bal.id },
            },
          }),
        ]);
        processed++;
      }
    }
    return { processed };
  }

  async getAllBalances() {
    const [users, balances, leaveTypes] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, employeeCode: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      this.prisma.leaveBalance.findMany(),
      this.prisma.leaveTypeMaster.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    ]);

    const balanceMap = new Map<string, Map<string, typeof balances[0]>>();
    for (const b of balances) {
      if (!balanceMap.has(b.userId)) balanceMap.set(b.userId, new Map());
      balanceMap.get(b.userId)!.set(b.leaveTypeCode, b);
    }

    return {
      leaveTypes: leaveTypes.map(lt => ({ code: lt.code, name: lt.name, isPaid: lt.isPaid })),
      users: users.map(u => ({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        employeeCode: u.employeeCode,
        balances: leaveTypes.map(lt => {
          const b = balanceMap.get(u.id)?.get(lt.code);
          return {
            leaveTypeCode: lt.code,
            earned: roundDays(b?.earnedBalance ?? 0),
            used: roundDays(b?.usedBalance ?? 0),
            carryForward: roundDays(b?.carryForward ?? 0),
            available: roundDays((b?.earnedBalance ?? 0) + (b?.carryForward ?? 0) - (b?.usedBalance ?? 0)),
          };
        }),
      })),
    };
  }

  async updateBalance(userId: string, leaveTypeCode: string, earnedBalance: number, carryForward?: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.leaveBalance.upsert({
      where: { userId_leaveTypeCode: { userId, leaveTypeCode } },
      update: {
        earnedBalance,
        ...(carryForward !== undefined ? { carryForward } : {}),
      },
      create: {
        userId,
        leaveTypeCode,
        earnedBalance,
        carryForward: carryForward ?? 0,
        usedBalance: 0,
      },
    });
  }

  async bulkUpdateBalances(updates: { email: string; leaveTypeCode: string; earnedBalance: number }[]) {
    let updated = 0;
    const errors: string[] = [];

    for (const update of updates) {
      const user = await this.prisma.user.findUnique({ where: { email: update.email.toLowerCase().trim() } });
      if (!user) {
        errors.push(`User not found: ${update.email}`);
        continue;
      }
      await this.prisma.leaveBalance.upsert({
        where: { userId_leaveTypeCode: { userId: user.id, leaveTypeCode: update.leaveTypeCode } },
        update: { earnedBalance: update.earnedBalance },
        create: { userId: user.id, leaveTypeCode: update.leaveTypeCode, earnedBalance: update.earnedBalance, usedBalance: 0, carryForward: 0 },
      });
      updated++;
    }

    return { updated, errors };
  }

  async initBalances(defaults: Record<string, number>, userId?: string) {
    const users = userId
      ? await this.prisma.user.findMany({ where: { id: userId, isActive: true }, select: { id: true } })
      : await this.prisma.user.findMany({ where: { isActive: true }, select: { id: true } });

    let created = 0;
    for (const user of users) {
      for (const [code, amount] of Object.entries(defaults)) {
        const existing = await this.prisma.leaveBalance.findUnique({
          where: { userId_leaveTypeCode: { userId: user.id, leaveTypeCode: code } },
        });
        if (!existing) {
          await this.prisma.leaveBalance.create({
            data: { userId: user.id, leaveTypeCode: code, earnedBalance: amount },
          });
          created++;
        }
      }
    }
    return { created, usersProcessed: users.length };
  }

  async exportLeaves(actorId: string, actorRole: string): Promise<Buffer> {
    const scope = await this.scopeResolver.getDataScope(actorRole, 'WORKFORCE_LEAVE_VIEW');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    const leaves = await this.prisma.leave.findMany({
      where: allowedIds ? { userId: { in: allowedIds } } : {},
      include: {
        user: {
          include: {
            department: true,
            reportingAuthority: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const columns = [
      { header: 'Employee Code', key: 'employeeCode' },
      { header: 'Employee Name', key: 'employeeName' },
      { header: 'Email', key: 'email' },
      { header: 'Department', key: 'department' },
      { header: 'Reporting Authority', key: 'reportingAuthority' },
      { header: 'Leave Type', key: 'leaveType' },
      { header: 'Start Date', key: 'startDate' },
      { header: 'End Date', key: 'endDate' },
      { header: 'Duration (days)', key: 'duration' },
      { header: 'Sandwich Days', key: 'sandwichDays' },
      { header: 'Half Day', key: 'isHalfDay' },
      { header: 'Half Day Session', key: 'halfDaySession' },
      { header: 'Reason', key: 'reason' },
      { header: 'RA Status', key: 'raStatus' },
      { header: 'PM Status', key: 'pmStatus' },
      { header: 'HR Status', key: 'hrStatus' },
      { header: 'Overall Status', key: 'status' },
      { header: 'Applied Date', key: 'appliedDate' },
    ];

    const rows = leaves.map((l) => ({
      employeeCode: l.user?.employeeCode ?? '',
      employeeName: [l.user?.firstName, l.user?.lastName].filter(Boolean).join(' ').trim(),
      email: l.user?.email ?? '',
      department: (l.user as any)?.department?.name ?? '',
      reportingAuthority: [
        (l.user as any)?.reportingAuthority?.firstName,
        (l.user as any)?.reportingAuthority?.lastName,
      ].filter(Boolean).join(' ').trim(),
      leaveType: l.leaveTypeCode ?? '',
      startDate: l.startDate?.toISOString().slice(0, 10) ?? '',
      endDate: l.endDate?.toISOString().slice(0, 10) ?? '',
      duration: l.duration ?? '',
      sandwichDays: l.sandwichDays ?? 0,
      isHalfDay: l.isHalfDay ? 'Yes' : 'No',
      halfDaySession: l.halfDaySession ?? '',
      reason: l.reason ?? '',
      raStatus: l.raStatus ?? '',
      pmStatus: l.pmStatus ?? '',
      hrStatus: l.hrStatus ?? '',
      status: l.status ?? '',
      appliedDate: l.createdAt?.toISOString().slice(0, 10) ?? '',
    }));

    return this.exportService.toExcel('My Leaves', columns, rows);
  }

  async runCarryForward() {
    const [leaveTypes, users] = await Promise.all([
      this.prisma.leaveTypeMaster.findMany({ where: { carryForwardMax: { gt: 0 }, isActive: true } }),
      this.prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);

    let carried = 0;
    for (const user of users) {
      for (const lt of leaveTypes) {
        const bal = await this.getBalance(user.id, lt.code);
        if (bal.available <= 0) continue;

        const carryAmount = Math.min(bal.available, lt.carryForwardMax);
        const expiryDate = lt.expiryMonths
          ? new Date(Date.now() + lt.expiryMonths * 30 * 24 * 60 * 60 * 1000)
          : null;

        await this.prisma.leaveBalance.upsert({
          where: { userId_leaveTypeCode: { userId: user.id, leaveTypeCode: lt.code } },
          update: { carryForward: carryAmount, earnedBalance: 0, usedBalance: 0, expiryDate },
          create: { userId: user.id, leaveTypeCode: lt.code, carryForward: carryAmount, earnedBalance: 0, usedBalance: 0, expiryDate },
        });
        carried++;
      }
    }
    return { carried };
  }
}
