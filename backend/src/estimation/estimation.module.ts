import { Module } from '@nestjs/common';
import { EstimationService } from './estimation.service';
import { EstimationController } from './estimation.controller';

@Module({
  controllers: [EstimationController],
  providers: [EstimationService],
})
export class EstimationModule {}
