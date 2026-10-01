import { Module } from '@nestjs/common';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { AdvancedAnalyticsController } from './advanced-analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AllocationInsightsModule } from '../allocation-insights/allocation-insights.module';
import { AnomaliesModule } from '../anomalies/anomalies.module';

@Module({
  imports: [PrismaModule, AllocationInsightsModule, AnomaliesModule],

  providers: [AdvancedAnalyticsService],
  controllers: [AdvancedAnalyticsController],
  exports: [AdvancedAnalyticsService],
})
export class AdvancedAnalyticsModule {}
