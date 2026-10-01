import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { AllocationInsightsModule } from '../allocation-insights/allocation-insights.module';

@Module({
  imports: [AllocationInsightsModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
