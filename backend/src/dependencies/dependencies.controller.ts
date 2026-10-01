import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards,
} from '@nestjs/common';
import { DependenciesService } from './dependencies.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { UpdateDependencyDto } from './dto/update-dependency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Dependencies')
@ApiBearerAuth()
@Controller('dependencies')
@UseGuards(JwtAuthGuard)
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new dependency for a project' })
  create(@Body() dto: CreateDependencyDto) {
    return this.dependenciesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of dependencies with optional project and status filters' })
  findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.dependenciesService.findAll(projectId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single dependency by ID' })
  findOne(@Param('id') id: string) {
    return this.dependenciesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing dependency by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateDependencyDto) {
    return this.dependenciesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dependency by ID' })
  remove(@Param('id') id: string) {
    return this.dependenciesService.remove(id);
  }
}
