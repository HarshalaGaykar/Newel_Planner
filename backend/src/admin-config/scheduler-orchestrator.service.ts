import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProjectDormancyCron } from '../projects/project-dormancy.cron';
import { AttendanceCheckinReminderCron } from '../attendance/attendance-checkin-reminder.cron';
import { AssetAllocationConfirmationCron } from '../asset-confirmations/asset-allocation-confirmation.cron';
import { AdminConfigService } from './admin-config.service';

/**
 * Maps scheduler-related AdminConfig keys to their cron service so that when a
 * key is saved via PUT /admin-config/:key the corresponding job is rescheduled
 * in-process without requiring a server restart.
 *
 * Only keys that affect the cron schedule (run_time, cron) trigger a reschedule.
 * Keys like `enabled`, `threshold_months`, `time_zone`, day numbers, and emails
 * are re-read live on every run tick — no reschedule needed for those.
 */
@Injectable()
export class SchedulerOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerOrchestratorService.name);

  // Prefixes whose run_time / cron keys require live rescheduling.
  private static readonly SCHEDULE_KEY_SUFFIXES = ['.run_time', '.cron'];

  private static readonly KEY_TO_JOB: Record<string, string> = {
    'project.dormancy': 'dormancy',
    'attendance.checkin_reminder': 'checkin',
    'asset.allocation_confirmation': 'asset',
  };

  constructor(
    private readonly adminConfig: AdminConfigService,
    private readonly dormancyCron: ProjectDormancyCron,
    private readonly checkinCron: AttendanceCheckinReminderCron,
    private readonly assetCron: AssetAllocationConfirmationCron,
  ) {}

  onModuleInit() {
    this.adminConfig.setRescheduleCallback(async (key: string) => {
      await this.rescheduleIfSchedulerKey(key);
    });
  }

  /**
   * Called after every successful AdminConfig upsert.
   * If the key belongs to a scheduler schedule field, the matching cron job
   * is stopped, rebuilt with the new config, and restarted immediately.
   */
  async rescheduleIfSchedulerKey(key: string): Promise<void> {
    const isScheduleKey = SchedulerOrchestratorService.SCHEDULE_KEY_SUFFIXES.some((suffix) =>
      key.endsWith(suffix),
    );
    if (!isScheduleKey) return;

    const prefix = Object.keys(SchedulerOrchestratorService.KEY_TO_JOB).find((p) =>
      key.startsWith(p),
    );
    if (!prefix) return;

    const job = SchedulerOrchestratorService.KEY_TO_JOB[prefix];
    this.logger.log(`Scheduler key "${key}" updated — rescheduling job: ${job}`);

    switch (job) {
      case 'dormancy':
        await this.dormancyCron.reschedule();
        break;
      case 'checkin':
        await this.checkinCron.reschedule();
        break;
      case 'asset':
        await this.assetCron.reschedule();
        break;
    }
  }
}
