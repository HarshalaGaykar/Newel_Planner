import { Module, Global, forwardRef } from '@nestjs/common';
import { AdminConfigService } from './admin-config.service';
import { NumberSeriesService } from './number-series.service';
import { AdminConfigController } from './admin-config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SchedulerOrchestratorService } from './scheduler-orchestrator.service';
import { ProjectsModule } from '../projects/projects.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AssetConfirmationsModule } from '../asset-confirmations/asset-confirmations.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => AttendanceModule),
    forwardRef(() => AssetConfirmationsModule),
  ],
  controllers: [AdminConfigController],
  providers: [AdminConfigService, NumberSeriesService, SchedulerOrchestratorService],
  exports: [AdminConfigService, NumberSeriesService],
})
export class AdminConfigModule {}
