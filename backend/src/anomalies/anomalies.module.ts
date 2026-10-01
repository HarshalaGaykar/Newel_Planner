import { Module } from '@nestjs/common';
import { AnomaliesService } from './anomalies.service';
import { AnomaliesController } from './anomalies.controller';

@Module({
  controllers: [AnomaliesController],
  providers: [AnomaliesService],
  exports: [AnomaliesService],
})

export class AnomaliesModule {}
