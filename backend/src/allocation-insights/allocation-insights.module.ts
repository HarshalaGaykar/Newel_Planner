import { Module } from '@nestjs/common';
import { AllocationInsightsService } from './allocation-insights.service';
import { AllocationInsightsController } from './allocation-insights.controller';

@Module({
  controllers: [AllocationInsightsController],
  providers: [AllocationInsightsService],
  exports: [AllocationInsightsService],
})
export class AllocationInsightsModule {}
