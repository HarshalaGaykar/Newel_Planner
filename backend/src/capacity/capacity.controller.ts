import { Controller, Get, Post, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CapacityService } from './capacity.service';

@ApiTags('Capacity')
@ApiBearerAuth()
@Controller('capacity')
export class CapacityController {
  constructor(private readonly capacityService: CapacityService) {}

  @Post('generate-snapshot')
  @ApiOperation({ summary: 'Generate a capacity snapshot for the given month and year' })
  generateSnapshot(
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe)
    month: number,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    year: number,
  ) {
    return this.capacityService.generateSnapshot(month, year);
  }

  @Get('demand-vs-supply')
  @ApiOperation({ summary: 'Get demand versus supply comparison for the given month and year' })
  getDemandVsSupply(
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe)
    month: number,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    year: number,
  ) {
    return this.capacityService.getDemandVsSupply(month, year);
  }

  @Get('bench-pool')
  @ApiOperation({ summary: 'Get the current bench pool of unallocated resources' })
  getBenchPool() {
    return this.capacityService.getBenchPool();
  }

  @Get('bench-aging')
  @ApiOperation({ summary: 'Get bench aging breakdown showing how long resources have been on the bench' })
  getBenchAging() {
    return this.capacityService.getBenchAging();
  }

  @Get('hiring-forecast')
  @ApiOperation({ summary: 'Get the hiring forecast for the upcoming number of months' })
  getHiringForecast(
    @Query('months', new DefaultValuePipe(3), ParseIntPipe) months: number,
  ) {
    return this.capacityService.getHiringForecast(months);
  }

  @Get('utilization-trend')
  @ApiOperation({ summary: 'Get the resource utilization trend over the given number of months' })
  getUtilizationTrend(
    @Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number,
  ) {
    return this.capacityService.getUtilizationTrend(months);
  }

  @Get('snapshot')
  @ApiOperation({ summary: 'Get the capacity snapshot for the given month and year' })
  getSnapshot(
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe)
    month: number,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    year: number,
  ) {
    return this.capacityService.getSnapshot(month, year);
  }

  @Get('grid')
  @ApiOperation({ summary: 'Get the capacity grid across the given number of months' })
  getCapacityGrid(
    @Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number,
  ) {
    return this.capacityService.getCapacityGrid(months);
  }

  @Get('allocation-dashboard')
  @ApiOperation({ summary: 'Get the allocation dashboard for the given month and year' })
  getAllocationDashboard(
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe)
    month: number,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    year: number,
  ) {
    return this.capacityService.getAllocationDashboard(month, year);
  }
}
