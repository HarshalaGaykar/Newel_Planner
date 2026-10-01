import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AllocationInsightsService } from './allocation-insights.service';

@ApiTags('Allocation Insights')
@ApiBearerAuth()
@Controller('allocation-insights')
export class AllocationInsightsController {
  constructor(private readonly insightsService: AllocationInsightsService) {}

  @Get('availability')
  @ApiOperation({ summary: 'Get resource availability within an optional date range' })
  getResourceAvailability(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.insightsService.getResourceAvailability(startDate, endDate);
  }

  @Get('user/:id')
  @ApiOperation({ summary: 'Analyze the current workload for a specific user by ID' })
  analyzeWorkload(@Param('id') id: string) {
    return this.insightsService.analyzeWorkload(id);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Suggest available resources for a department with a minimum free capacity' })
  suggestResources(
    @Query('departmentId') departmentId: string,
    @Query('minFreeCapacity') minFreeCapacity: number,
  ) {
    return this.insightsService.suggestResources(departmentId, minFreeCapacity);
  }
}
