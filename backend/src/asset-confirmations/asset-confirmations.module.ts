import { Module } from '@nestjs/common';
import { AssetConfirmationsService } from './asset-confirmations.service';
import { AssetConfirmationsController } from './asset-confirmations.controller';
import { AssetAllocationConfirmationCron } from './asset-allocation-confirmation.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AssetConfirmationsController],
  providers: [AssetConfirmationsService, AssetAllocationConfirmationCron],
  exports: [AssetConfirmationsService, AssetAllocationConfirmationCron],
})
export class AssetConfirmationsModule {}
