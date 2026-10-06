import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto, CheckOutDto, AttendanceFilterDto } from './dto/attendance.dto';
import {
  buildZonedDateFilter,
  getUtcForZonedLocalDateTime,
  getZonedDateParts,
  getZonedDayRange,
  getZonedDateOnlyRange,
  resolveTimeZone,
} from './time-zone.util';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getTodayStatus(userId: string, timeZone?: string) {
    const resolvedTimeZone = resolveTimeZone(timeZone);
    const now = new Date();
    const dayRange = getZonedDayRange(now, resolvedTimeZone);
    return this.findAttendanceInRange(userId, dayRange);
  }

  async checkIn(userId: string, dto: CheckInDto) {
    const timeZone = resolveTimeZone(dto.timeZone);
    const now = new Date();
    const dayRange = getZonedDayRange(now, timeZone);
    const dayParts = getZonedDateParts(now, timeZone);
    const existing = await this.findAttendanceInRange(userId, dayRange);
    if (existing) {
      throw new BadRequestException('Already checked in for today');
    }

    // Fetch user with shift info
    const userWithShift = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shiftId: true, shift: true },
    });

    let attendanceStatus = 'PRESENT';
    let shiftId: string | undefined;

    if (userWithShift?.shift) {
      const shift = userWithShift.shift;
      shiftId = shift.id;
      // Parse shift start time "HH:mm"
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const shiftStart = getUtcForZonedLocalDateTime(
        timeZone,
        dayParts.year,
        dayParts.month,
        dayParts.day,
        startH,
        startM + 15, // grace 15 min
      );
      if (now > shiftStart) {
        attendanceStatus = 'LATE';
      }
    } else {
      // Fallback: LATE if after 10:00 AM
      if (dayParts.hour >= 10) {
        attendanceStatus = 'LATE';
      }
    }

    return this.prisma.attendance.create({
      data: {
        userId,
        date: dayRange.start,
        checkIn: now,
        checkInTimeZone: timeZone,
        status: attendanceStatus,
        remarks: dto.remarks,
        isWfh: dto.isWfh ?? false,
        ...(shiftId ? { shiftId } : {}),
      },
    });
  }

  async checkOut(userId: string, dto: CheckOutDto) {
    const timeZone = resolveTimeZone(dto.timeZone);
    const record = await this.getTodayStatus(userId, timeZone);
    if (!record) {
      throw new BadRequestException('No check-in found for today');
    }
    if (record.checkOut) {
      throw new BadRequestException('Already checked out for today');
    }
    
    const now = new Date();
    let overtimeHours = 0;

    if (record.checkIn && record.shift) {
      const shift = record.shift;
      const workedMs = now.getTime() - record.checkIn.getTime();
      const workedHours = workedMs / 3600000 - shift.breakMinutes / 60;

      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      const shiftHours =
        (endH * 60 + endM - (startH * 60 + startM)) / 60 - shift.breakMinutes / 60;

      overtimeHours = Math.max(0, workedHours - shiftHours);
    }

    return this.prisma.attendance.update({
      where: { id: record.id },
      data: {
        checkOut: now,
        checkOutTimeZone: timeZone,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        remarks: dto.remarks
          ? `${record.remarks || ''} | Out: ${dto.remarks}`
          : record.remarks,
      },
    });
  }

  async getDailySummary(userId: string, date: string, timeZone?: string) {
    const resolvedTimeZone = resolveTimeZone(timeZone);
    const dayRange = getZonedDateOnlyRange(date, resolvedTimeZone);

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        userId,
        date: {
          gte: dayRange.start,
          lt: dayRange.end,
        },
      },
      include: { shift: true },
    });

    const regularization = await this.prisma.attendanceRegularization.findFirst({
      where: {
        userId,
        date: {
          gte: dayRange.start,
          lt: dayRange.end,
        },
      },
      include: { approver: { select: { firstName: true, lastName: true } } },
    });

    return { attendance, regularization };
  }

  async findAll(actorId: string, actorRole: string, filter: AttendanceFilterDto) {
    const where: any = { userId: actorId };
    const timeZone = resolveTimeZone(filter.timeZone);
    const dateFilter = buildZonedDateFilter(filter.startDate, filter.endDate, timeZone);

    if (dateFilter) where.date = dateFilter;

    const records = await this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    if (filter.startDate) {
      const absentEntries = await this.buildAbsentEntries(
        actorId,
        filter.startDate,
        filter.endDate,
        timeZone,
        records,
      );
      if (absentEntries.length > 0) {
        const combined = [...records, ...absentEntries] as any[];
        combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return combined;
      }
    }

    return records;
  }

  private async buildAbsentEntries(
    userId: string,
    startDate: string,
    endDate: string | undefined,
    timeZone: string,
    existingRecords: { date: Date | string }[],
  ): Promise<any[]> {
    const now = new Date();

    // Cap at yesterday — never mark today as absent (user may still clock in)
    const yesterdayUtc = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yParts = getZonedDateParts(yesterdayUtc, timeZone);
    const yesterdayStr = `${yParts.year}-${String(yParts.month).padStart(2, '0')}-${String(yParts.day).padStart(2, '0')}`;

    const effectiveEndStr = endDate && endDate < yesterdayStr ? endDate : yesterdayStr;
    if (startDate > effectiveEndStr) return [];

    // Normalise existing record dates to YYYY-MM-DD in the user's timezone
    const coveredDates = new Set<string>(
      existingRecords.map((r) => {
        const p = getZonedDateParts(new Date(r.date as any), timeZone);
        return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
      }),
    );

    // Public holidays in range
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lte: new Date(`${effectiveEndStr}T23:59:59.999Z`),
        },
        isOptional: false,
      },
      select: { date: true },
    });
    const holidayDates = new Set<string>(
      holidays.map((h) => h.date.toISOString().split('T')[0]),
    );

    // Approved regularizations in range — these dates should NOT be marked absent
    const regDateFilter = buildZonedDateFilter(startDate, effectiveEndStr, timeZone);
    const approvedRegs = await this.prisma.attendanceRegularization.findMany({
      where: {
        userId,
        status: 'APPROVED',
        ...(regDateFilter ? { date: regDateFilter } : {}),
      },
      select: { date: true },
    });
    const regDates = new Set<string>(
      approvedRegs.map((r) => {
        const p = getZonedDateParts(new Date(r.date), timeZone);
        return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
      }),
    );

    // Walk each calendar day from startDate to effectiveEndStr
    const absentEntries: any[] = [];
    let currentDate = startDate;

    while (currentDate <= effectiveEndStr) {
      const dayOfWeek = new Date(`${currentDate}T12:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat

      if (
        dayOfWeek !== 0 &&
        dayOfWeek !== 6 &&
        !holidayDates.has(currentDate) &&
        !coveredDates.has(currentDate) &&
        !regDates.has(currentDate)
      ) {
        const dayRange = getZonedDateOnlyRange(currentDate, timeZone);
        absentEntries.push({
          id: `absent-${userId}-${currentDate}`,
          userId,
          date: dayRange.start,
          checkIn: null,
          checkOut: null,
          checkInTimeZone: null,
          checkOutTimeZone: null,
          status: 'ABSENT',
          remarks: null,
          isWfh: false,
          overtimeHours: 0,
          shiftId: null,
          createdAt: dayRange.start,
          updatedAt: dayRange.start,
        });
      }

      // Advance one calendar day
      const d = new Date(`${currentDate}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      currentDate = d.toISOString().split('T')[0];
    }

    return absentEntries;
  }

  /**
   * Active users who had NO check-in on a given working day.
   *
   * Applies the same working-day rules as {@link buildAbsentEntries} — skips
   * weekends, non-optional public holidays, and users with an APPROVED
   * regularization — and additionally excludes users on APPROVED full-day leave
   * (half-day leave still expects a check-in). Used by the missing check-in
   * reminder cron. Returns an empty list when the day itself is a non-working day.
   *
   * "No check-in" means there is no Attendance row with a non-null `checkIn`
   * for that user on that day (a row present with `checkIn = null` still counts
   * as missing).
   */
  async getMissingCheckinUsers(dateStr: string, timeZone?: string) {
    const tz = resolveTimeZone(timeZone);

    // Whole-day boundary in the requested time zone.
    const dayRange = getZonedDateOnlyRange(dateStr, tz);

    // Weekend → nothing is "missing".
    const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) return [];

    // Non-optional public holiday → nothing is "missing".
    const holiday = await this.prisma.publicHoliday.findFirst({
      where: {
        isOptional: false,
        date: { gte: dayRange.start, lt: dayRange.end },
      },
      select: { id: true },
    });
    if (holiday) return [];

    // Users who actually checked in that day.
    const checkedIn = await this.prisma.attendance.findMany({
      where: {
        date: { gte: dayRange.start, lt: dayRange.end },
        checkIn: { not: null },
      },
      select: { userId: true },
    });
    const checkedInIds = new Set(checkedIn.map((a) => a.userId));

    // Users with an APPROVED regularization that day — already excused.
    const approvedRegs = await this.prisma.attendanceRegularization.findMany({
      where: {
        status: 'APPROVED',
        date: { gte: dayRange.start, lt: dayRange.end },
      },
      select: { userId: true },
    });
    const regularizedIds = new Set(approvedRegs.map((r) => r.userId));

    // Users on APPROVED full-day leave covering that day (half-day still expects a check-in).
    const leaves = await this.prisma.leave.findMany({
      where: {
        status: 'APPROVED',
        isHalfDay: false,
        startDate: { lt: dayRange.end },
        endDate: { gte: dayRange.start },
      },
      select: { userId: true },
    });
    const onLeaveIds = new Set(leaves.map((l) => l.userId));

    // All active users with the data the reminder mail needs.
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        reportingAuthorityId: true,
        reportingAuthority: {
          select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
        },
        shift: { select: { startTime: true } },
      },
    });

    return users
      .filter(
        (u) =>
          !checkedInIds.has(u.id) &&
          !regularizedIds.has(u.id) &&
          !onLeaveIds.has(u.id),
      )
      .map((u) => ({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        reportingAuthorityId: u.reportingAuthorityId,
        reportingAuthority: u.reportingAuthority,
        shiftStart: u.shift?.startTime ?? null,
      }));
  }

  async getTeamAttendance(actorId: string, actorRole: string, filter: AttendanceFilterDto) {
    const allowedIds = await this.resolveTeamAttendanceUserIds(actorId, actorRole);
    const timeZone = resolveTimeZone(filter.timeZone);

    const where: any = {};

    if (filter.userId) {
      if (allowedIds && !allowedIds.includes(filter.userId)) {
        return [];
      }
      where.userId = filter.userId;
    } else if (allowedIds) {
      if (allowedIds.length === 0) {
        return [];
      }
      where.userId = { in: allowedIds };
    }

    const dateFilter = buildZonedDateFilter(filter.startDate, filter.endDate, timeZone);
    if (dateFilter) where.date = dateFilter;

    return this.prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { user: { firstName: 'asc' } }],
    });
  }

  private async resolveTeamAttendanceUserIds(actorId: string, actorRole: string) {
    if (['ADMIN', 'HR'].includes(actorRole)) {
      return null;
    }

    const directReports = await this.prisma.user.findMany({
      where: { reportingAuthorityId: actorId, isActive: true },
      select: { id: true },
    });

    return directReports.map((user) => user.id);
  }

  private findAttendanceInRange(
    userId: string,
    dayRange: { start: Date; end: Date },
  ) {
    return this.prisma.attendance.findFirst({
      where: {
        userId,
        date: {
          gte: dayRange.start,
          lt: dayRange.end,
        },
      },
      include: { shift: true },
    });
  }

  /**
   * Whether the user has a recorded check-in for the calendar day containing `date`
   * (evaluated in `timeZone`, default UTC) — or an approved regularization standing
   * in for a missed one. Used to gate timesheet entry creation.
   */
  async hasCheckedIn(userId: string, date: Date, timeZone?: string): Promise<boolean> {
    const resolvedTimeZone = resolveTimeZone(timeZone);
    const dayRange = getZonedDayRange(date, resolvedTimeZone);
    const record = await this.prisma.attendance.findFirst({
      where: {
        userId,
        checkIn: { not: null },
        OR: [
          // Primary: match by stored date field (how check-in normally records)
          { date: { gte: dayRange.start, lt: dayRange.end } },
          // Fallback: match by actual checkIn timestamp (handles IST rounding edge case
          // where stored date may differ by milliseconds from the computed range boundary)
          { checkIn: { gte: dayRange.start, lt: dayRange.end } },
        ],
      },
      select: { id: true },
    });
    if (record) return true;

    const approvedRegularization = await this.prisma.attendanceRegularization.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        date: { gte: dayRange.start, lt: dayRange.end },
      },
      select: { id: true },
    });
    return !!approvedRegularization;
  }

}