import { Module } from '@nestjs/common';
import { CapacityController } from './capacity.controller';
import { CapacityService } from './capacity.service';
import { CapacitySnapshotCron } from './capacity-snapshot.cron';

@Module({
  controllers: [CapacityController],
  providers: [CapacityService, CapacitySnapshotCron],
  exports: [CapacityService],
})
export class CapacityModule {}
