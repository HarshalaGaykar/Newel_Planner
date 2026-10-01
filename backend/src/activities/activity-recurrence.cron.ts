import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ActivitiesService } from './activities.service';

/**
 * Keeps every active recurring to-do materialised to the rolling horizon.
 *
 * Generation deliberately sends no notifications: assignees are told once when
 * the series is created, so a nightly top-up of an open-ended daily series stays
 * silent instead of mailing everyone ninety times.
 */
@Injectable()
export class ActivityRecurrenceCron {
  private readonly logger = new Logger(ActivityRecurrenceCron.name);

  constructor(private readonly activitiesService: ActivitiesService) {}

  // 01:30 daily — off-peak, and well clear of the 08:00 alert crons.
  @Cron('30 1 * * *')
  async extendRecurrenceHorizons() {
    try {
      const { seriesScanned, occurrencesCreated } = await this.activitiesService.extendAllHorizons();
      this.logger.log(
        `Recurrence horizon sweep: ${seriesScanned} series scanned, ${occurrencesCreated} occurrence(s) created`,
      );
    } catch (error) {
      this.logger.error(
        `Recurrence horizon sweep failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
