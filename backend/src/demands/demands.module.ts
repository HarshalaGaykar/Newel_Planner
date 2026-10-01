import { Module } from '@nestjs/common';
import { DemandsController } from './demands.controller';
import { DemandsService } from './demands.service';
import { DemandsListener } from './demands.listener';
import { WorkflowModule } from '../workflow/workflow.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    WorkflowModule,
    NotificationsModule,
  ],
  controllers: [DemandsController],
  providers: [DemandsService, DemandsListener],
  exports: [DemandsService],
})
export class DemandsModule {}
