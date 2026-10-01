import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { EmailKind, EmailLogStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminConfigService } from '../admin-config/admin-config.service';
import { EmailService } from '../notifications/email.service';
import { AttendanceService } from './attendance.service';
import { getZonedDateParts, resolveTimeZone } from './time-zone.util';

const JOB_NAME = 'attendance-checkin-reminder';

// Fallbacks used only when the corresponding AdminConfig key is missing/blank/invalid,
// so the job is always safe even before the config rows are seeded.
const DEFAULT_CRON = '0 9 * * *'; // daily at 09:00, reporting the previous day
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

// AdminConfig keys (seeded by prisma/seed-admin-configuration.ts).
const KEY_ENABLED = 'attendance.checkin_reminder.enabled';
const KEY_RUN_TIME = 'attendance.checkin_reminder.run_time';
const KEY_CRON = 'attendance.checkin_reminder.cron';
const KEY_TIME_ZONE = 'attendance.checkin_reminder.time_zone';

const fullName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'Employee';

/**
 * Daily "missing check-in" reminder.
 *
 * Runs the next morning, finds everyone with no check-in on the previous working
 * day (weekends, public holidays and approved full-day leave excluded), and emails
 * the employee + their reporting authority per-person, plus a single digest to HR.
 * Every send — success and detailed failure — is recorded in `EmailLog`, which is
 * also the source of idempotency (a day's mail is never sent twice).
 *
 * Mirrors the project-dormancy cron: the schedule is read from AdminConfig at
 * startup and registered dynamically; `enabled` is re-read live on every run;
 * schedule changes take effect on the next app restart.
 */
@Injectable()
export class AttendanceCheckinReminderCron implements OnModuleInit {
  private readonly logger = new Logger(AttendanceCheckinReminderCron.name);

  constructor(
    private prisma: PrismaService,
    private adminConfig: AdminConfigService,
    private emailService: EmailService,
    private attendanceService: AttendanceService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    const cronExpr = await this.resolveSchedule();
    const job = CronJob.from({
      cronTime: cronExpr,
      onTick: () => {
        void this.run();
      },
    });
    this.schedulerRegistry.addCronJob(JOB_NAME, job as any);
    job.start();
    this.logger.log(`Attendance check-in reminder job scheduled with "${cronExpr}"`);
  }

  /** Recompute the schedule from AdminConfig and restart the cron job live. */
  async reschedule() {
    const cronExpr = await this.resolveSchedule();
    try {
      const existing = this.schedulerRegistry.getCronJob(JOB_NAME);
      existing.stop();
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
    } catch {
      // Job may not exist yet — safe to ignore
    }
    const job = CronJob.from({
      cronTime: cronExpr,
      onTick: () => {
        void this.run();
      },
    });
    this.schedulerRegistry.addCronJob(JOB_NAME, job as any);
    job.start();
    this.logger.log(`[Reschedule] Attendance check-in reminder rescheduled with "${cronExpr}"`);
  }

  /** `cron` expression wins if set; otherwise build a daily schedule from `run_time` (HH:mm). */
  private async resolveSchedule(): Promise<string> {
    const cron = await this.safeGet(KEY_CRON);
    if (cron) return cron;

    const runTime = await this.safeGet(KEY_RUN_TIME);
    if (runTime && /^\d{1,2}:\d{2}$/.test(runTime)) {
      const [h, m] = runTime.split(':').map(Number);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${m} ${h} * * *`;
    }
    return DEFAULT_CRON;
  }

  private async safeGet(key: string): Promise<string | null> {
    try {
      const value = await this.adminConfig.get(key);
      return value?.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * @param overrideDate  Optional 'YYYY-MM-DD' to evaluate instead of "yesterday"
   *                      (used by the manual trigger endpoint for testing).
   * @param manual        When true, bypasses the `enabled` toggle so a disabled
   *                      job can still be exercised on demand.
   */
  async run(overrideDate?: string, manual = false) {
    // Enable/disable toggle — read live so it takes effect without a restart.
    if (!manual) {
      const enabled = (await this.safeGet(KEY_ENABLED)) ?? 'true';
      if (enabled.toLowerCase() !== 'true') {
        this.logger.log('Check-in reminder run skipped — disabled via admin config.');
        return { skipped: true, reason: 'disabled' };
      }
    }

    const tz = resolveTimeZone((await this.safeGet(KEY_TIME_ZONE)) ?? DEFAULT_TIME_ZONE);

    let dateStr: string;
    if (overrideDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
        throw new BadRequestException('date must be in YYYY-MM-DD format');
      }
      dateStr = overrideDate;
    } else {
      // The previous calendar day in the configured time zone (fully closed).
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const p = getZonedDateParts(yesterday, tz);
      dateStr = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    }

    const missing = await this.attendanceService.getMissingCheckinUsers(dateStr, tz);
    if (missing.length === 0) {
      this.logger.log(`No missing check-ins for ${dateStr}.`);
      return { date: dateStr, missingCount: 0 };
    }
    this.logger.warn(`Found ${missing.length} missing check-in(s) for ${dateStr}.`);

    const contextDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Per-employee: notify the employee.
    for (const u of missing) {
      const employeeName = fullName(u);

      // Employee mail
      await this.sendOnce({
        dedupeKey: `checkin-missing:emp:${u.userId}:${dateStr}`,
        kind: EmailKind.ATTENDANCE_CHECKIN_MISSING_EMPLOYEE,
        recipient: u.email,
        subjectUserId: u.userId,
        contextDate,
        templateName: 'attendance-checkin-missing-employee',
        send: () =>
          this.emailService.sendCheckinMissingEmployee(u.email, employeeName, dateStr, u.shiftStart),
      });
    }

    // One digest per reporting authority with only their own team members.
    await this.sendRaDigests(dateStr, contextDate, missing);

    // Single HR digest for the whole day.
    await this.sendHrDigest(dateStr, contextDate, missing);

    return { date: dateStr, missingCount: missing.length };
  }

  private async sendRaDigests(
    dateStr: string,
    contextDate: Date,
    missing: {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      reportingAuthority: { id?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null; isActive?: boolean | null } | null;
    }[],
  ) {
    const grouped = new Map<string, {
      ra: NonNullable<(typeof missing)[number]['reportingAuthority']>;
      employees: typeof missing;
    }>();

    for (const u of missing) {
      const employeeName = fullName(u);
      const ra = u.reportingAuthority;

      if (!ra?.id || !ra.isActive || !ra.email) {
        await this.logEmail({
          kind: EmailKind.ATTENDANCE_CHECKIN_MISSING_RA,
          status: EmailLogStatus.FAILED,
          recipient: '',
          subject: `Team member missing check-in for ${dateStr}: ${employeeName}`,
          templateName: 'attendance-checkin-missing-ra',
          subjectUserId: u.userId,
          contextDate,
          error: 'No active reporting authority on file for this employee.',
        });
        continue;
      }

      const existing = grouped.get(ra.id);
      if (existing) {
        existing.employees.push(u);
      } else {
        grouped.set(ra.id, { ra, employees: [u] });
      }
    }

    for (const group of grouped.values()) {
      const rowsHtml = group.employees
        .map((u, i) => `<tr><td>${i + 1}</td><td>${fullName(u)}</td><td>${u.email}</td></tr>`)
        .join('');

      await this.sendOnce({
        dedupeKey: `checkin-missing:ra:${group.ra.id}:${dateStr}`,
        kind: EmailKind.ATTENDANCE_CHECKIN_MISSING_RA,
        recipient: group.ra.email!,
        subjectUserId: null,
        contextDate,
        templateName: 'attendance-checkin-missing-ra',
        metadata: { absenteeCount: group.employees.length },
        send: () =>
          this.emailService.sendCheckinMissingRA(
            group.ra.email!,
            fullName(group.ra),
            dateStr,
            group.employees.length,
            rowsHtml,
          ),
      });
    }
  }

  private async sendHrDigest(
    dateStr: string,
    contextDate: Date,
    missing: {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      reportingAuthority: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
    }[],
  ) {
    // Gate the whole digest on a prior successful send for this date.
    const alreadySent = await this.prisma.emailLog.findFirst({
      where: {
        kind: EmailKind.ATTENDANCE_CHECKIN_MISSING_HR_DIGEST,
        status: EmailLogStatus.SUCCESS,
        contextDate,
      },
      select: { id: true },
    });
    if (alreadySent) return;

    const hrUsers = await this.prisma.user.findMany({
      where: { role: { name: 'HR' }, isActive: true },
      select: { email: true },
    });
    if (hrUsers.length === 0) {
      this.logger.log('No active HR users to receive the check-in digest.');
      return;
    }

    const rowsHtml = missing
      .map((u, i) => {
        const emp = fullName(u);
        const ra = u.reportingAuthority ? fullName(u.reportingAuthority) : '—';
        return `<tr><td>${i + 1}</td><td>${emp}</td><td>${ra}</td></tr>`;
      })
      .join('');

    for (const hr of hrUsers) {
      await this.sendOnce({
        dedupeKey: `checkin-missing:hr:${dateStr}:${hr.email}`,
        kind: EmailKind.ATTENDANCE_CHECKIN_MISSING_HR_DIGEST,
        recipient: hr.email,
        subjectUserId: null,
        contextDate,
        templateName: 'attendance-checkin-missing-hr-digest',
        metadata: { absenteeCount: missing.length },
        send: () =>
          this.emailService.sendCheckinMissingHrDigest(hr.email, dateStr, missing.length, rowsHtml),
      });
    }
  }

  /**
   * Sends one email and records the outcome in EmailLog. Idempotent: if a SUCCESS
   * row already carries this `dedupeKey`, the send is skipped. Failures are logged
   * with the full error and NO dedupeKey, so they remain retryable on a re-run.
   */
  private async sendOnce(opts: {
    dedupeKey: string;
    kind: EmailKind;
    recipient: string;
    subjectUserId: string | null;
    contextDate: Date;
    templateName: string;
    metadata?: any;
    send: () => Promise<{ messageId?: string } | any>;
  }) {
    const existing = await this.prisma.emailLog.findFirst({
      where: { dedupeKey: opts.dedupeKey, status: EmailLogStatus.SUCCESS },
      select: { id: true },
    });
    if (existing) return;

    const subject = `[${opts.kind}] ${opts.contextDate.toISOString().split('T')[0]}`;

    try {
      const info = await opts.send();
      await this.logEmail({
        kind: opts.kind,
        status: EmailLogStatus.SUCCESS,
        recipient: opts.recipient,
        subject,
        templateName: opts.templateName,
        messageId: info?.messageId ?? null,
        subjectUserId: opts.subjectUserId,
        contextDate: opts.contextDate,
        dedupeKey: opts.dedupeKey,
        metadata: opts.metadata,
      });
    } catch (error: any) {
      await this.logEmail({
        kind: opts.kind,
        status: EmailLogStatus.FAILED,
        recipient: opts.recipient,
        subject,
        templateName: opts.templateName,
        subjectUserId: opts.subjectUserId,
        contextDate: opts.contextDate,
        metadata: opts.metadata,
        error: this.formatError(error),
      });
      this.logger.error(`Failed to send ${opts.kind} to ${opts.recipient}: ${error?.message ?? error}`);
    }
  }

  private formatError(error: any): string {
    if (!error) return 'Unknown error';
    const parts = [error.message, error.code, error.response, error.stack].filter(Boolean);
    return parts.length ? parts.join(' | ') : String(error);
  }

  private async logEmail(data: {
    kind: EmailKind;
    status: EmailLogStatus;
    recipient: string;
    subject: string;
    templateName?: string | null;
    messageId?: string | null;
    subjectUserId?: string | null;
    contextDate?: Date | null;
    dedupeKey?: string | null;
    metadata?: any;
    error?: string | null;
  }) {
    try {
      await this.prisma.emailLog.create({
        data: {
          kind: data.kind,
          status: data.status,
          recipient: data.recipient,
          subject: data.subject,
          templateName: data.templateName ?? null,
          messageId: data.messageId ?? null,
          subjectUserId: data.subjectUserId ?? null,
          contextDate: data.contextDate ?? null,
          dedupeKey: data.dedupeKey ?? null,
          metadata: data.metadata ?? undefined,
          error: data.error ?? null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to write EmailLog: ${err?.message ?? err}`);
    }
  }
}
