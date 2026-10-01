import { Module } from '@nestjs/common';
import { PriorityMasterController } from './priority-master.controller';
import { PriorityMasterService } from './priority-master.service';

@Module({
  controllers: [PriorityMasterController],
  providers: [PriorityMasterService],
  exports: [PriorityMasterService],
})
export class PriorityMasterModule {}
