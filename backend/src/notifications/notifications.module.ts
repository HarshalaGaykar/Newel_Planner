import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { EmailLogService } from './email-log.service';
import { NotificationSchedulerService } from './notification-scheduler.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailService,
    EmailLogService,
    NotificationSchedulerService,
  ],
  exports: [NotificationsService, EmailService, EmailLogService],
})
export class NotificationsModule {}
