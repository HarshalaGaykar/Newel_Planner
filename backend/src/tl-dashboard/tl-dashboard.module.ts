import { Module } from '@nestjs/common';
import { TlDashboardController } from './tl-dashboard.controller';
import { TlDashboardService } from './tl-dashboard.service';

@Module({
  controllers: [TlDashboardController],
  providers: [TlDashboardService],
})
export class TlDashboardModule {}
