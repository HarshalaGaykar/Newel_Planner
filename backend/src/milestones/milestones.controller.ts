import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@ApiTags('Milestones')
@ApiBearerAuth()
@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new milestone under a project' })
  create(@Body() createMilestoneDto: CreateMilestoneDto) {
    return this.milestonesService.create(createMilestoneDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of milestones, optionally filtered by project' })
  findAll(@Query('projectId') projectId?: string) {
    return this.milestonesService.findAll(projectId);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all milestones for a specific project' })
  findByProject(@Param('projectId') projectId: string) {
    return this.milestonesService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single milestone by ID' })
  findOne(@Param('id') id: string) {
    return this.milestonesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing milestone by ID' })
  update(@Param('id') id: string, @Body() updateMilestoneDto: UpdateMilestoneDto) {
    return this.milestonesService.update(id, updateMilestoneDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a milestone by ID' })
  remove(@Param('id') id: string) {
    return this.milestonesService.remove(id);
  }
}
