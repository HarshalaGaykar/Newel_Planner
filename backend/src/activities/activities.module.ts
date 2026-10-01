import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { ActivityRecurrenceCron } from './activity-recurrence.cron';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivityRecurrenceCron],
})
export class ActivitiesModule {}
