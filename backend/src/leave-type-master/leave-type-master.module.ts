import { Module } from '@nestjs/common';
import { LeaveTypeMasterController } from './leave-type-master.controller';
import { LeaveTypeMasterService } from './leave-type-master.service';

@Module({
  controllers: [LeaveTypeMasterController],
  providers: [LeaveTypeMasterService],
  exports: [LeaveTypeMasterService],
})
export class LeaveTypeMasterModule {}
