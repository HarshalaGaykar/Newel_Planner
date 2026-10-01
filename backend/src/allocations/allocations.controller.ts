import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { AllocationsService } from './allocations.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { BulkCreateAllocationDto } from './dto/bulk-create-allocation.dto';
import { UpdateAllocationDto } from './dto/update-allocation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Allocations')
@ApiBearerAuth()
@Controller('allocations')
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new resource allocation for a project' })
  create(@Body() createAllocationDto: CreateAllocationDto) {
    return this.allocationsService.create(createAllocationDto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple resource allocations in a single request' })
  createBulk(@Body() dto: BulkCreateAllocationDto) {
    return this.allocationsService.createBulk(dto.allocations);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Get resource availability for a given date filtered by skills' })
  getResourceAvailability(
    @Query('date') date?: string,
    @Query('skillIds') skillIds?: string,
  ) {
    return this.allocationsService.getResourceAvailability(date, skillIds);
  }

  @Get('upcoming-free')
  @ApiOperation({ summary: 'Get resources becoming free within an upcoming number of days' })
  getUpcomingFree(@Query('days') days?: string) {
    return this.allocationsService.getUpcomingFree(days ? Number(days) : 7);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a list of allocations with optional user, project, date-range and status filters' })
  findAll(
    @CurrentUser() actor: any,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('freelancerId') freelancerId?: string,
    @Query('active') active?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.allocationsService.findAll(actor.userId, actor.role, userId, projectId, freelancerId, active === 'true', from, to);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single allocation by ID' })
  findOne(@Param('id') id: string) {
    return this.allocationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing allocation by ID' })
  update(@Param('id') id: string, @Body() updateAllocationDto: UpdateAllocationDto) {
    return this.allocationsService.update(id, updateAllocationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an allocation by ID' })
  remove(@Param('id') id: string) {
    return this.allocationsService.remove(id);
  }
}
