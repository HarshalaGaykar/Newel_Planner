import { Module } from '@nestjs/common';
import { BusinessUnitController } from './business-unit.controller';
import { BusinessUnitService } from './business-unit.service';

@Module({
  controllers: [BusinessUnitController],
  providers: [BusinessUnitService],
  exports: [BusinessUnitService],
})
export class BusinessUnitModule {}
