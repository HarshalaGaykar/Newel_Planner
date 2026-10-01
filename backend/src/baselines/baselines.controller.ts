import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BaselinesService } from './baselines.service';
import { CreateBaselineDto } from './dto/create-baseline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Baselines')
@ApiBearerAuth()
@Controller('baselines')
@UseGuards(JwtAuthGuard)
export class BaselinesController {
  constructor(private readonly baselinesService: BaselinesService) {}

  @Post()
  @ApiOperation({ summary: 'Capture a new baseline snapshot for a project' })
  capture(@Body() dto: CreateBaselineDto, @CurrentUser() user: any) {
    return this.baselinesService.capture(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all baselines for a given project' })
  findAll(@Query('projectId') projectId: string) {
    return this.baselinesService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single baseline by ID' })
  findOne(@Param('id') id: string) {
    return this.baselinesService.findOne(id);
  }

  @Get(':id/compare')
  @ApiOperation({ summary: 'Compare a baseline against the current project state' })
  compare(@Param('id') id: string) {
    return this.baselinesService.compare(id);
  }
}
