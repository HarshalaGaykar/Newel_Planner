import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { AdminConfigService } from '../admin-config/admin-config.service';

const JOB_NAME = 'project-dormancy';

// Fallbacks used only when the corresponding AdminConfig key is missing/blank/invalid,
// so the job is always safe even before the config rows are seeded.
const DEFAULT_CRON = '59 12 * * *';
const DEFAULT_THRESHOLD_MONTHS = 2;

// AdminConfig keys (seeded by prisma/seed-admin-configuration.ts).
const KEY_ENABLED = 'project.dormancy.enabled';
const KEY_RUN_TIME = 'project.dormancy.run_time';
const KEY_THRESHOLD_MONTHS = 'project.dormancy.threshold_months';
const KEY_CRON = 'project.dormancy.cron';

@Injectable()
export class ProjectDormancyCron implements OnModuleInit {
  private readonly logger = new Logger(ProjectDormancyCron.name);

  constructor(
    private prisma: PrismaService,
    private projectsService: ProjectsService,
    private adminConfig: AdminConfigService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  // The schedule is read from AdminConfig at startup and registered dynamically.
  // enabled + threshold are re-read live on every run; call reschedule() to apply
  // schedule changes (run_time / cron) without restarting the server.
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
    this.logger.log(`Project dormancy job scheduled with "${cronExpr}"`);
  }

  /** Recompute the schedule from AdminConfig and restart the cron job live. */
  async reschedule() {
    const cronExpr = await this.resolveSchedule();
    try {
      const existing = this.schedulerRegistry.getCronJob(JOB_NAME);
      existing.stop();
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
    } catch {
      // Job may not exist yet on first call — safe to ignore
    }
    const job = CronJob.from({
      cronTime: cronExpr,
      onTick: () => {
        void this.run();
      },
    });
    this.schedulerRegistry.addCronJob(JOB_NAME, job as any);
    job.start();
    this.logger.log(`[Reschedule] Project dormancy rescheduled with "${cronExpr}"`);
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

  async run() {
    // Enable/disable toggle — read live so it takes effect without a restart.
    const enabled = (await this.safeGet(KEY_ENABLED)) ?? 'true';
    if (enabled.toLowerCase() !== 'true') {
      this.logger.log('Project dormancy run skipped — disabled via admin config.');
      return;
    }

    // Inactivity threshold in months — read live, with a safe fallback.
    let thresholdMonths = DEFAULT_THRESHOLD_MONTHS;
    const rawThreshold = await this.safeGet(KEY_THRESHOLD_MONTHS);
    if (rawThreshold) {
      const n = parseInt(rawThreshold, 10);
      if (!Number.isNaN(n) && n > 0) thresholdMonths = n;
    }

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setMonth(cutoff.getMonth() - thresholdMonths);

    // 1. Only genuinely-running projects are eligible.
    const candidates = await this.prisma.project.findMany({
      where: { status: { in: [ProjectStatus.ACTIVE, ProjectStatus.APPROVED] } },
      select: { id: true, name: true, startDate: true },
    });
    if (candidates.length === 0) return;

    // 2. Latest timesheet activity per candidate in a single grouped query (no N+1).
    const lastActivity = await this.prisma.timesheetEntry.groupBy({
      by: ['projectId'],
      _max: { date: true },
      where: { projectId: { in: candidates.map((c) => c.id) } },
    });
    const lastByProject = new Map(lastActivity.map((r) => [r.projectId, r._max.date]));

    // 3. Dormant if last entry is older than the cutoff, or — for a project that never had
    //    any entry — if its start date is older than the cutoff (grace from project start).
    let inactivated = 0;
    for (const project of candidates) {
      const lastDate = lastByProject.get(project.id);
      const dormant = lastDate ? lastDate < cutoff : project.startDate < cutoff;
      if (!dormant) continue;

      const changed = await this.projectsService.systemTransition(project.id, ProjectStatus.INACTIVE, {
        actorId: null,
        reason: `No timesheet activity for ${thresholdMonths}+ month(s)`,
        notifyPm: true,
      });
      if (changed) {
        inactivated++;
        this.logger.warn(`[Dormancy] Auto-inactivated project ${project.name} (${project.id})`);
      }
    }

    if (inactivated > 0) {
      this.logger.log(`Auto-inactivated ${inactivated} dormant project(s)`);
    }
  }
}
