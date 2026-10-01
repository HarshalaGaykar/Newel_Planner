import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { PriorityMasterService } from './priority-master.service';
import { CreatePriorityMasterDto } from './dto/create-priority-master.dto';
import { UpdatePriorityMasterDto } from './dto/update-priority-master.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Priority Masters')
@ApiBearerAuth()
@Controller({ path: 'priority-masters', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PriorityMasterController {
  constructor(private priorityMasterService: PriorityMasterService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all priority masters' })
  findAll() {
    return this.priorityMasterService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single priority master by ID' })
  findOne(@Param('id') id: string) {
    return this.priorityMasterService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new priority master' })
  create(@Body() dto: CreatePriorityMasterDto) {
    return this.priorityMasterService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing priority master by ID' })
  update(@Param('id') id: string, @Body() dto: UpdatePriorityMasterDto) {
    return this.priorityMasterService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a priority master by ID' })
  remove(@Param('id') id: string) {
    return this.priorityMasterService.remove(id);
  }
}
