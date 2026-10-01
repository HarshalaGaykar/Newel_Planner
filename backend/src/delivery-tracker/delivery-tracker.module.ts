import { Module } from '@nestjs/common';
import { DeliveryTrackerController } from './delivery-tracker.controller';
import { DeliveryTrackerService } from './delivery-tracker.service';
import { ExportService } from '../reports/export.service';
import { TrackerReportHtmlService } from '../reports/tracker-report-html.service';
import { ProjectRecipientsModule } from '../project-recipients/project-recipients.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ProjectRecipientsModule, NotificationsModule],
  controllers: [DeliveryTrackerController],
  providers: [DeliveryTrackerService, ExportService, TrackerReportHtmlService],
})
export class DeliveryTrackerModule {}
