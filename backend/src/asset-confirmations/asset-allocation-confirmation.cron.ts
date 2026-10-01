import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { EmailKind, EmailLogStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminConfigService } from '../admin-config/admin-config.service';
import { EmailService } from '../notifications/email.service';
import { AssetConfirmationsService, RaWithAssets, TeamAsset } from './asset-confirmations.service';
import { getZonedDateParts, resolveTimeZone } from '../attendance/time-zone.util';

const JOB_NAME = 'asset-allocation-confirmation';

const DEFAULT_CRON = '0 9 * * *'; // daily 09:00; the day-of-month decides the stage
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

const KEY_ENABLED = 'asset.allocation_confirmation.enabled';
const KEY_RUN_TIME = 'asset.allocation_confirmation.run_time';
const KEY_CRON = 'asset.allocation_confirmation.cron';
const KEY_TIME_ZONE = 'asset.allocation_confirmation.time_zone';
const KEY_DAY_INITIAL = 'asset.allocation_confirmation.day_initial';
const KEY_DAY_R1 = 'asset.allocation_confirmation.day_reminder1';
const KEY_DAY_R2 = 'asset.allocation_confirmation.day_reminder2';
const KEY_DAY_FINAL = 'asset.allocation_confirmation.day_final';
const KEY_CC_EMAIL = 'asset.allocation_confirmation.cc_email';
const KEY_ESCALATION_EMAIL = 'asset.allocation_confirmation.escalation_email';

type Stage = 'initial' | 'r5' | 'r7' | 'r10';

const fullName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'Manager';

const STAGE_NOTE: Record<Stage, string> = {
  initial: '',
  r5: '<div class="note">Reminder: your confirmation for this month is still pending.</div>',
  r7: '<div class="note">Second reminder: please confirm. Your reporting head has been copied on this email.</div>',
  r10: '<div class="note">Final reminder: this pending confirmation has been escalated to management.</div>',
};

/**
 * Monthly asset-allocation confirmation escalation.
 *
 * A single daily job whose behaviour depends on the day of month (all configurable):
 *   - day 1  → create this month's PENDING confirmations for every manager with team
 *              assets and send the initial request.
 *   - day 5  → remind managers who have not confirmed.
 *   - day 7  → remind the still-pending, cc the configured head (Yogesh).
 *   - day 10 → remind the still-pending, cc the head + escalation recipient (Pravin).
 *
 * "Team assets" = assets whose current holder reports to the manager. Sends are logged
 * and deduped through EmailLog (one send per manager/period/stage).
 */
@Injectable()
export class AssetAllocationConfirmationCron implements OnModuleInit {
  private readonly logger = new Logger(AssetAllocationConfirmationCron.name);

  constructor(
    private prisma: PrismaService,
    private adminConfig: AdminConfigService,
    private emailService: EmailService,
    private confirmations: AssetConfirmationsService,
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
    this.logger.log(`Asset allocation confirmation job scheduled with "${cronExpr}"`);
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
    this.logger.log(`[Reschedule] Asset allocation confirmation rescheduled with "${cronExpr}"`);
  }

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

  private async dayNum(key: string, fallback: number): Promise<number> {
    const raw = await this.safeGet(key);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 28 ? n : fallback;
  }

  /**
   * @param opts.date   'YYYY-MM-DD' to evaluate instead of today (manual testing).
   * @param opts.stage  force a specific stage instead of deriving from the day of month.
   * @param opts.manual bypass the `enabled` toggle.
   */
  async run(opts: { date?: string; stage?: Stage; manual?: boolean } = {}) {
    if (!opts.manual) {
      const enabled = (await this.safeGet(KEY_ENABLED)) ?? 'true';
      if (enabled.toLowerCase() !== 'true') {
        this.logger.log('Asset confirmation run skipped — disabled via admin config.');
        return { skipped: true, reason: 'disabled' };
      }
    }

    const tz = resolveTimeZone((await this.safeGet(KEY_TIME_ZONE)) ?? DEFAULT_TIME_ZONE);
    const baseDate = opts.date ? new Date(`${opts.date}T12:00:00Z`) : new Date();
    const parts = getZonedDateParts(baseDate, tz);
    const period = `${parts.year}-${String(parts.month).padStart(2, '0')}`;

    const [dInitial, dR1, dR2, dFinal] = await Promise.all([
      this.dayNum(KEY_DAY_INITIAL, 1),
      this.dayNum(KEY_DAY_R1, 5),
      this.dayNum(KEY_DAY_R2, 7),
      this.dayNum(KEY_DAY_FINAL, 10),
    ]);

    let stage: Stage | null = opts.stage ?? null;
    if (!stage) {
      const dom = parts.day;
      if (dom === dInitial) stage = 'initial';
      else if (dom === dR1) stage = 'r5';
      else if (dom === dR2) stage = 'r7';
      else if (dom === dFinal) stage = 'r10';
    }

    if (!stage) {
      this.logger.log(`No asset-confirmation stage for day ${parts.day}.`);
      return { period, stage: null, processed: 0 };
    }

    this.logger.log(`Asset confirmation stage "${stage}" for ${period}.`);
    const processed = stage === 'initial'
      ? await this.runInitial(period)
      : await this.runReminder(period, stage);

    return { period, stage, processed };
  }

  /** Day 1: create PENDING rows and send the initial request. */
  private async runInitial(period: string): Promise<number> {
    const groups = await this.confirmations.getRAsWithTeamAssets();
    const contextDate = new Date(`${period}-01T00:00:00.000Z`);
    const monthLabel = this.confirmations.monthLabel(period);

    for (const g of groups) {
      // Create the confirmation if it doesn't already exist; never reset an existing one.
      const existing = await this.prisma.assetAllocationConfirmation.findUnique({
        where: { reportingAuthorityId_period: { reportingAuthorityId: g.ra.id, period } },
      });
      if (!existing) {
        await this.prisma.assetAllocationConfirmation.create({
          data: { reportingAuthorityId: g.ra.id, period, status: 'PENDING', assetCount: g.assets.length },
        });
      }

      await this.sendStage(g.ra, g.assets, period, monthLabel, contextDate, 'initial');
    }
    return groups.length;
  }

  /** Days 5/7/10: chase managers still PENDING for the period. */
  private async runReminder(period: string, stage: Stage): Promise<number> {
    const pending = await this.prisma.assetAllocationConfirmation.findMany({
      where: { period, status: 'PENDING' },
      include: {
        reportingAuthority: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
      },
    });

    const cc = await this.ccFor(stage);
    const contextDate = new Date(`${period}-01T00:00:00.000Z`);
    const monthLabel = this.confirmations.monthLabel(period);

    let count = 0;
    for (const row of pending) {
      const ra = row.reportingAuthority;
      if (!ra?.isActive || !ra.email) continue;
      const assets = await this.confirmations.getTeamAssetsForRA(ra.id);
      await this.sendStage(
        { id: ra.id, firstName: ra.firstName, lastName: ra.lastName, email: ra.email },
        assets,
        period,
        monthLabel,
        contextDate,
        stage,
        cc,
      );
      count++;
    }
    return count;
  }

  private async ccFor(stage: Stage): Promise<string[]> {
    const ccEmail = await this.safeGet(KEY_CC_EMAIL);
    const escalationEmail = await this.safeGet(KEY_ESCALATION_EMAIL);
    if (stage === 'r7') return [ccEmail].filter((e): e is string => !!e);
    if (stage === 'r10') return [ccEmail, escalationEmail].filter((e): e is string => !!e);
    return [];
  }

  private buildRows(assets: TeamAsset[]): string {
    if (!assets.length) return '<tr><td colspan="5">No assets currently recorded.</td></tr>';
    return assets
      .map(
        (a, i) =>
          `<tr><td>${i + 1}</td><td>${a.assetTag}</td><td>${a.name}</td><td>${a.type}</td><td>${a.usedByName}</td></tr>`,
      )
      .join('');
  }

  private async sendStage(
    ra: RaWithAssets['ra'],
    assets: TeamAsset[],
    period: string,
    monthLabel: string,
    contextDate: Date,
    stage: Stage,
    cc: string[] = [],
  ) {
    const dedupeKey = `asset-confirm:${ra.id}:${period}:${stage}`;
    const existing = await this.prisma.emailLog.findFirst({
      where: { dedupeKey, status: EmailLogStatus.SUCCESS },
      select: { id: true },
    });
    if (existing) return;

    const subject = `Confirm your team's asset allocations (${monthLabel})`;
    try {
      const info = await this.emailService.sendAssetAllocationConfirmation(
        ra.email,
        {
          raName: fullName(ra),
          monthLabel,
          assetCount: assets.length,
          rowsHtml: this.buildRows(assets),
          reminderNote: STAGE_NOTE[stage],
        },
        cc,
      );
      await this.logEmail({
        status: EmailLogStatus.SUCCESS,
        recipient: ra.email,
        subject,
        messageId: (info as any)?.messageId ?? null,
        subjectUserId: ra.id,
        contextDate,
        dedupeKey,
        metadata: { stage, period, cc },
      });
    } catch (error: any) {
      await this.logEmail({
        status: EmailLogStatus.FAILED,
        recipient: ra.email,
        subject,
        subjectUserId: ra.id,
        contextDate,
        metadata: { stage, period, cc },
        error: this.formatError(error),
      });
      this.logger.error(`Failed to send asset confirmation (${stage}) to ${ra.email}: ${error?.message ?? error}`);
    }
  }

  private formatError(error: any): string {
    if (!error) return 'Unknown error';
    const parts = [error.message, error.code, error.response, error.stack].filter(Boolean);
    return parts.length ? parts.join(' | ') : String(error);
  }

  private async logEmail(data: {
    status: EmailLogStatus;
    recipient: string;
    subject: string;
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
          kind: EmailKind.ASSET_ALLOCATION_CONFIRMATION,
          status: data.status,
          recipient: data.recipient,
          subject: data.subject,
          templateName: 'asset-allocation-confirmation',
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
