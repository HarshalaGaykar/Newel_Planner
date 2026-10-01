import { Module } from '@nestjs/common';
import { FreelancersController } from './freelancers.controller';
import { FreelancersService } from './freelancers.service';
import { FreelancerExpiryCron } from './freelancer-expiry.cron';

@Module({
  controllers: [FreelancersController],
  providers: [FreelancersService, FreelancerExpiryCron],
  exports: [FreelancersService],
})
export class FreelancersModule {}
