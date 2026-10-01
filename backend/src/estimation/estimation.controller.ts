import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EstimationService } from './estimation.service';

@ApiTags('Estimation')
@ApiBearerAuth()
@Controller('estimation')
export class EstimationController {
  constructor(private readonly estimationService: EstimationService) {}

  @Get()
  @ApiOperation({ summary: 'Estimate effort for an activity by sub-activity and complexity' })
  estimate(
    @Query('activity') activity: string,
    @Query('subActivity') subActivity: string,
    @Query('complexity') complexity: string,
  ) {
    return this.estimationService.estimateEffort(activity, subActivity, complexity);
  }
}
