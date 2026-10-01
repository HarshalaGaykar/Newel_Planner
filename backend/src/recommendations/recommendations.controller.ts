import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('resources/:taskId')
  @ApiOperation({ summary: 'Get recommended resources for a task by task ID' })
  recommendResources(@Param('taskId') taskId: string) {
    return this.recommendationsService.recommendResources(taskId);
  }

  @Get('deadline/:taskId')
  @ApiOperation({ summary: 'Get a suggested deadline adjustment for a task by task ID' })
  suggestDeadlineAdjustment(@Param('taskId') taskId: string) {
    return this.recommendationsService.suggestDeadlineAdjustment(taskId);
  }
}
