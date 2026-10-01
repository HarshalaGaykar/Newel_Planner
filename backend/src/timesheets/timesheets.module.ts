import { Module } from '@nestjs/common';
import { TimesheetsService } from './timesheets.service';
import { TimesheetsController } from './timesheets.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';
import { ProjectsModule } from '../projects/projects.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [NotificationsModule, CommonModule, ProjectsModule, AttendanceModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
})
export class TimesheetsModule {}
