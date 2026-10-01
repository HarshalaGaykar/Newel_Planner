import { Module } from '@nestjs/common';
import { DeliveryStageMasterController } from './delivery-stage-master.controller';
import { DeliveryStageMasterService } from './delivery-stage-master.service';

@Module({
  controllers: [DeliveryStageMasterController],
  providers: [DeliveryStageMasterService],
  exports: [DeliveryStageMasterService],
})
export class DeliveryStageMasterModule {}
