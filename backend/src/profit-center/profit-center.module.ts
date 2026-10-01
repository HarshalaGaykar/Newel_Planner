import { Module } from '@nestjs/common';
import { ProfitCenterController } from './profit-center.controller';
import { ProfitCenterService } from './profit-center.service';

@Module({
  controllers: [ProfitCenterController],
  providers: [ProfitCenterService],
  exports: [ProfitCenterService],
})
export class ProfitCenterModule {}
