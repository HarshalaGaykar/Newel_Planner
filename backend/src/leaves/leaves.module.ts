import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { LeaveTypeMasterModule } from '../leave-type-master/leave-type-master.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExportService } from '../reports/export.service';

@Module({
  imports: [LeaveTypeMasterModule, CommonModule, NotificationsModule],
  controllers: [LeavesController],
  providers: [LeavesService, ExportService],
  exports: [LeavesService],
})
export class LeavesModule {}
