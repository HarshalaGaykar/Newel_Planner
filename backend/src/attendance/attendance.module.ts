import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceRegularizationService } from './attendance-regularization.service';
import { AttendanceRegularizationController } from './attendance-regularization.controller';
import { AttendanceCheckinReminderCron } from './attendance-checkin-reminder.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, CommonModule, NotificationsModule],
  controllers: [AttendanceController, AttendanceRegularizationController],
  providers: [AttendanceService, AttendanceRegularizationService, AttendanceCheckinReminderCron],
  exports: [AttendanceService, AttendanceRegularizationService, AttendanceCheckinReminderCron],
})
export class AttendanceModule {}
