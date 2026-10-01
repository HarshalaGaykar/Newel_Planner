import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EmailKind, EmailLogStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminConfigService } from '../admin-config/admin-config.service';
import { EmailService } from '../notifications/email.service';
import { EmailLogService } from '../notifications/email-log.service';
import { CreateRegularizationDto, RegularizationFilterDto } from './dto/attendance.dto';
import {
  DEFAULT_TIME_ZONE,
  buildZonedDateFilter,
  getUtcForZonedLocalDateTime,
  getZonedDateOnlyRange,
  getZonedDateParts,
  getZonedDayRange,
  parseDateTimeInTimeZone,
  resolveTimeZone,
} from './time-zone.util';

@Injectable()
export class AttendanceRegularizationService {
  private readonly logger = new Logger(AttendanceRegularizationService.name);

  constructor(
    private prisma: PrismaService,
    private adminConfig: AdminConfigService,
    private emailService: EmailService,
    private emailLog: EmailLogService,
  ) {}

  // ── Regularization mail thread ────────────────────────────────────────────

  private displayName(user: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Unknown user';
  }

  /** Dates and times are rendered in the timezone they were captured in, not UTC. */
  private formatInZone(value: Date | null | undefined, timeZone: string | null | undefined) {
    if (!value) return 'Not requested';
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || DEFAULT_TIME_ZONE,
    }).format(value);
  }

  private formatDateInZone(value: Date, timeZone: string | null | undefined) {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeZone: timeZone || DEFAULT_TIME_ZONE,
    }).format(value);
  }

  private humaniseReason(reason: string) {
    return reason.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
  }

  /** What is actually wrong with the attendance record being corrected. */
  private missingSummary(attendance: { checkIn: Date | null; checkOut: Date | null } | null) {
    if (!attendance) return 'No attendance record for this date';
    if (!attendance.checkIn && !attendance.checkOut) return 'Check-in and check-out both missing';
    if (!attendance.checkIn) return 'Check-in missing';
    if (!attendance.checkOut) return 'Check-out missing';
    return 'Existing record to be corrected';
  }

  /**
   * Mails the reporting authority that a request needs their decision, CC'ing the
   * requester so the later decision mail threads for both of them.
   *
   * Never throws: a mail problem must not undo a submitted request.
   */
  private async sendRequestMail(regularizationId: string) {
    const reg = await this.prisma.attendanceRegularization.findUnique({
      where: { id: regularizationId },
      include: {
        attendance: { select: { checkIn: true, checkOut: true } },
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true, employeeCode: true,
            department: { select: { name: true } },
            reportingAuthority: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!reg) return;

    const approver = reg.user.reportingAuthority;
    if (!approver?.email) {
      // 78 of 95 employed users currently have no reporting authority, so this is
      // the common path rather than an edge case. Such a request also cannot be
      // approved at all — assertReportingAuthority requires a match.
      this.logger.warn(
        `Regularization ${reg.id}: ${reg.user.email} has no reporting authority with an email — ` +
          'no request mail sent, and the request cannot be actioned until an RA is mapped',
      );
      return;
    }

    const employeeName = this.displayName(reg.user);
    const dateLabel = this.formatDateInZone(reg.date, reg.requestedInTimeZone);
    const subject = this.emailService.regularizationSubject(employeeName, dateLabel);

    try {
      const info = await this.emailService.sendRegularizationRequest(
        approver.email,
        {
          regularizationId: reg.id,
          approverName: approver.firstName || approver.email,
          employeeName,
          employeeCode: reg.user.employeeCode,
          department: reg.user.department?.name ?? null,
          regularizationDate: dateLabel,
          missingSummary: this.missingSummary(reg.attendance),
          reason: this.humaniseReason(reg.reason),
          requestedIn: this.formatInZone(reg.requestedIn, reg.requestedInTimeZone),
          requestedOut: this.formatInZone(reg.requestedOut, reg.requestedOutTimeZone),
          remarks: reg.remarks,
          submittedAt: this.formatInZone(reg.createdAt, reg.requestedInTimeZone),
        },
        reg.user.email ?? undefined,
      );

      await this.prisma.attendanceRegularization.update({
        where: { id: reg.id },
        data: {
          // Prefer what the transport actually used; fall back to our own form.
          requestMailMessageId:
            (info as any)?.messageId ?? this.emailService.regularizationMessageId(reg.id),
          requestMailSentAt: new Date(),
        },
      });

      await this.emailLog.record({
        kind: EmailKind.ATTENDANCE_REGULARIZATION_REQUEST,
        status: EmailLogStatus.SUCCESS,
        recipient: approver.email,
        subject,
        templateName: 'attendance-regularization-request',
        messageId: (info as any)?.messageId ?? null,
        subjectUserId: reg.userId,
        dedupeKey: `attendance-reg:${reg.id}:request`,
        metadata: { cc: reg.user.email },
      });

      this.logger.log(`Regularization ${reg.id}: request mail sent to ${approver.email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Regularization ${reg.id}: request mail to ${approver.email} failed — ${message}`);
      await this.emailLog.record({
        kind: EmailKind.ATTENDANCE_REGULARIZATION_REQUEST,
        status: EmailLogStatus.FAILED,
        recipient: approver.email,
        subject,
        templateName: 'attendance-regularization-request',
        error: message,
        subjectUserId: reg.userId,
      });
    }
  }

  /**
   * Replies to the request thread with the outcome, addressed to the requester
   * and CC'ing the approver. Never throws.
   */
  private async sendDecisionMail(regularizationId: string, approved: boolean) {
    const reg = await this.prisma.attendanceRegularization.findUnique({
      where: { id: regularizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        approver: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!reg) return;

    if (!reg.user.email) {
      this.logger.warn(`Regularization ${reg.id}: requester has no email — decision mail skipped`);
      return;
    }

    const employeeName = this.displayName(reg.user);
    const dateLabel = this.formatDateInZone(reg.date, reg.requestedInTimeZone);
    const subject = `Re: ${this.emailService.regularizationSubject(employeeName, dateLabel)}`;

    try {
      const info = await this.emailService.sendRegularizationDecision(
        reg.user.email,
        {
          approved,
          employeeName,
          approverName: reg.approver ? this.displayName(reg.approver) : 'Reporting authority',
          regularizationDate: dateLabel,
          decidedAt: this.formatInZone(reg.approvedAt ?? new Date(), reg.requestedInTimeZone),
          decisionRemarks: reg.decisionRemarks,
          reason: this.humaniseReason(reg.reason),
          requestedIn: this.formatInZone(reg.requestedIn, reg.requestedInTimeZone),
          requestedOut: this.formatInZone(reg.requestedOut, reg.requestedOutTimeZone),
          remarks: reg.remarks,
          inReplyTo:
            reg.requestMailMessageId ?? this.emailService.regularizationMessageId(reg.id),
        },
        reg.approver?.email ?? undefined,
      );

      await this.emailLog.record({
        kind: EmailKind.ATTENDANCE_REGULARIZATION_DECISION,
        status: EmailLogStatus.SUCCESS,
        recipient: reg.user.email,
        subject,
        templateName: 'attendance-regularization-decision',
        messageId: (info as any)?.messageId ?? null,
        subjectUserId: reg.userId,
        dedupeKey: `attendance-reg:${reg.id}:decision`,
        metadata: { outcome: approved ? 'APPROVED' : 'REJECTED', cc: reg.approver?.email ?? null },
      });

      this.logger.log(
        `Regularization ${reg.id}: ${approved ? 'approval' : 'rejection'} mail sent to ${reg.user.email}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Regularization ${reg.id}: decision mail to ${reg.user.email} failed — ${message}`);
      await this.emailLog.record({
        kind: EmailKind.ATTENDANCE_REGULARIZATION_DECISION,
        status: EmailLogStatus.FAILED,
        recipient: reg.user.email,
        subject,
        templateName: 'attendance-regularization-decision',
        error: message,
        subjectUserId: reg.userId,
      });
    }
  }

  async create(dto: CreateRegularizationDto, userId: string) {
    const timeZone = resolveTimeZone(dto.timeZone);
    const requestRange = getZonedDateOnlyRange(dto.date, timeZone);
    const now = new Date();
    const todayRange = getZonedDayRange(now, timeZone);

    if (requestRange.start > todayRange.start) {
      throw new BadRequestException('Cannot regularize a future date');
    }

    // Get max lookback days from AdminConfig (default 7)
    let maxDays = 7;
    try {
      maxDays = await this.adminConfig.getNumber('attendance.regularization_max_days');
    } catch {
      // use default
    }

    const todayParts = getZonedDateParts(now, timeZone);
    const cutoff = getUtcForZonedLocalDateTime(
      timeZone,
      todayParts.year,
      todayParts.month,
      todayParts.day - maxDays,
    );
    if (requestRange.start < cutoff) {
      throw new BadRequestException(
        `Regularization allowed only within last ${maxDays} days`,
      );
    }

    // Check for existing regularization for same user+date
    const existing = await this.prisma.attendanceRegularization.findFirst({
      where: {
        userId,
        OR: [
          {
            date: {
              gte: requestRange.start,
              lt: requestRange.end,
            },
          },
          ...(dto.attendanceId ? [{ attendanceId: dto.attendanceId }] : []),
        ],
      },
    });

    if (existing) {
      throw new BadRequestException('A regularization request already exists for this date');
    }

    // Find the attendance record for linking
    const attendance = dto.attendanceId
      ? await this.prisma.attendance.findFirst({
          where: { id: dto.attendanceId, userId },
        })
      : await this.prisma.attendance.findFirst({
          where: {
            userId,
            date: {
              gte: requestRange.start,
              lt: requestRange.end,
            },
          },
        });

    if (dto.attendanceId && !attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    const requestedIn = dto.requestedIn
      ? parseDateTimeInTimeZone(dto.requestedIn, timeZone)
      : undefined;
    const requestedOut = dto.requestedOut
      ? parseDateTimeInTimeZone(dto.requestedOut, timeZone)
      : undefined;

    const regularization = await this.prisma.attendanceRegularization.create({
      data: {
        userId,
        date: requestRange.start,
        requestedIn,
        requestedInTimeZone: requestedIn ? timeZone : undefined,
        requestedOut,
        requestedOutTimeZone: requestedOut ? timeZone : undefined,
        reason: dto.reason as any,
        remarks: dto.remarks,
        attendanceId: attendance?.id ?? null,
      },
      include: { user: { select: { firstName: true, lastName: true, reportingAuthorityId: true } } },
    });

    // Awaited so a send failure is logged against this request while the context
    // is still here; sendRequestMail swallows its own errors so the submitted
    // request is never lost to a mail problem.
    await this.sendRequestMail(regularization.id);

    return regularization;
  }

  async findMyRequests(userId: string, filter: RegularizationFilterDto) {
    const where: any = { userId };
    const timeZone = resolveTimeZone(filter.timeZone);
    const dateFilter = buildZonedDateFilter(filter.startDate, filter.endDate, timeZone);

    if (dateFilter) where.date = dateFilter;

    return this.prisma.attendanceRegularization.findMany({
      where,
      include: {
        approver: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPending(approverId: string, filter: RegularizationFilterDto) {
    const where: any = {
      status: 'PENDING',
      user: { reportingAuthorityId: approverId },
      userId: { not: approverId },
    };
    const timeZone = resolveTimeZone(filter.timeZone);

    if (filter.userId) {
      if (filter.userId === approverId) return [];
      where.userId = filter.userId;
    }

    const dateFilter = buildZonedDateFilter(filter.startDate, filter.endDate, timeZone);
    if (dateFilter) where.date = dateFilter;

    return this.prisma.attendanceRegularization.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(id: string, approverId: string, decisionRemarks?: string) {
    const reg = await this.prisma.attendanceRegularization.findUnique({
      where: { id },
      include: {
        attendance: { include: { shift: true } },
        user: { select: { reportingAuthorityId: true } },
      },
    });

    if (!reg) throw new NotFoundException('Regularization request not found');
    if (reg.status !== 'PENDING') {
      throw new BadRequestException('Request is no longer pending');
    }
    this.assertReportingAuthority(reg, approverId);

    // Update regularization
    await this.prisma.attendanceRegularization.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId,
        approvedAt: new Date(),
        decisionRemarks: decisionRemarks?.trim() || null,
      },
    });

    // Update attendance record
    if (reg.attendanceId) {
      // ── EXISTING attendance record ──
      const checkIn = reg.requestedIn ?? reg.attendance?.checkIn ?? undefined;
      const checkOut = reg.requestedOut ?? reg.attendance?.checkOut ?? undefined;

      let overtimeHours = reg.attendance?.overtimeHours ?? 0;

      if (checkIn && checkOut && reg.attendance?.shift) {
        const shift = reg.attendance.shift;
        const workedHours =
          (checkOut.getTime() - checkIn.getTime()) / 3600000 - shift.breakMinutes / 60;
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const shiftHours =
          (endH * 60 + endM - (startH * 60 + startM)) / 60 - shift.breakMinutes / 60;
        overtimeHours = Math.max(0, Math.round((workedHours - shiftHours) * 100) / 100);
      }

      await this.prisma.attendance.update({
        where: { id: reg.attendanceId },
        data: {
          ...(reg.requestedIn
            ? { checkIn: reg.requestedIn, checkInTimeZone: reg.requestedInTimeZone }
            : {}),
          ...(reg.requestedOut
            ? { checkOut: reg.requestedOut, checkOutTimeZone: reg.requestedOutTimeZone }
            : {}),
          overtimeHours,
          status: 'PRESENT',
        },
      });
    } else {
      // ── NO attendance record (employee was ABSENT) — create one ──
      const checkIn = reg.requestedIn;
      const checkOut = reg.requestedOut;

      let overtimeHours = 0;
      // Try to compute overtime from shift if available
      const userWithShift = await this.prisma.user.findUnique({
        where: { id: reg.userId },
        select: { shiftId: true, shift: true },
      });

      if (checkIn && checkOut && userWithShift?.shift) {
        const shift = userWithShift.shift;
        const workedHours =
          (checkOut.getTime() - checkIn.getTime()) / 3600000 - shift.breakMinutes / 60;
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const shiftHours =
          (endH * 60 + endM - (startH * 60 + startM)) / 60 - shift.breakMinutes / 60;
        overtimeHours = Math.max(0, Math.round((workedHours - shiftHours) * 100) / 100);
      }

      const newAttendance = await this.prisma.attendance.create({
        data: {
          userId: reg.userId,
          date: reg.date,
          checkIn,
          checkInTimeZone: reg.requestedInTimeZone,
          checkOut,
          checkOutTimeZone: reg.requestedOutTimeZone,
          status: 'PRESENT',
          overtimeHours,
          remarks: `Regularized: ${reg.reason}`,
          ...(userWithShift?.shiftId ? { shiftId: userWithShift.shiftId } : {}),
        },
      });

      // Link the new attendance record back to the regularization
      await this.prisma.attendanceRegularization.update({
        where: { id },
        data: { attendanceId: newAttendance.id },
      });
    }

    await this.sendDecisionMail(id, true);

    return this.prisma.attendanceRegularization.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async reject(id: string, approverId: string, decisionRemarks?: string) {
    const reg = await this.prisma.attendanceRegularization.findUnique({
      where: { id },
      include: { user: { select: { reportingAuthorityId: true } } },
    });

    if (!reg) throw new NotFoundException('Regularization request not found');
    if (reg.status !== 'PENDING') {
      throw new BadRequestException('Request is no longer pending');
    }
    this.assertReportingAuthority(reg, approverId);

    const updated = await this.prisma.attendanceRegularization.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId,
        approvedAt: new Date(),
        decisionRemarks: decisionRemarks?.trim() || null,
      },
    });

    await this.sendDecisionMail(id, false);

    return updated;
  }

  private assertReportingAuthority(
    regularization: { userId: string; user: { reportingAuthorityId: string | null } },
    approverId: string,
  ) {
    if (regularization.userId === approverId) {
      throw new ForbiddenException('You cannot approve or reject your own regularization request');
    }

    if (regularization.user.reportingAuthorityId !== approverId) {
      throw new ForbiddenException(
        'Only the requester reporting authority can approve or reject this regularization request',
      );
    }
  }
}