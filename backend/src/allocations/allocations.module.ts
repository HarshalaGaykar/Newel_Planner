import { Module } from '@nestjs/common';
import { AllocationsService } from './allocations.service';
import { AllocationsController } from './allocations.controller';
import { FreelancersModule } from '../freelancers/freelancers.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [FreelancersModule, CommonModule],
  controllers: [AllocationsController],
  providers: [AllocationsService],
  exports: [AllocationsService],
})
export class AllocationsModule {}
