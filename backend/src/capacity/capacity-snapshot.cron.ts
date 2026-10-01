import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CapacityService } from './capacity.service';

@Injectable()
export class CapacitySnapshotCron {
  private readonly logger = new Logger(CapacitySnapshotCron.name);

  constructor(private readonly capacityService: CapacityService) {}

  @Cron('0 1 1 * *')
  async handleMonthlySnapshot() {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevYear = prevMonthDate.getFullYear();
    this.logger.log(`Running monthly capacity snapshot for ${prevMonth}/${prevYear}`);
    await this.capacityService.generateSnapshot(prevMonth, prevYear);
  }
}
