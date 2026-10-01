import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExportService } from '../reports/export.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, ExportService],
})
export class TasksModule {}
