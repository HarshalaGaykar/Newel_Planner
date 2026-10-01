import { Module } from '@nestjs/common';
import { CostCenterController } from './cost-center.controller';
import { CostCenterService } from './cost-center.service';

@Module({
  controllers: [CostCenterController],
  providers: [CostCenterService],
  exports: [CostCenterService],
})
export class CostCenterModule {}
