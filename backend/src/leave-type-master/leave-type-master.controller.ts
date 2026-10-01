import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { LeaveTypeMasterService } from './leave-type-master.service';
import { CreateLeaveTypeMasterDto } from './dto/create-leave-type-master.dto';
import { UpdateLeaveTypeMasterDto } from './dto/update-leave-type-master.dto';

@ApiTags('Leave Type Master')
@ApiBearerAuth()
@Controller({ path: 'leave-type-masters', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveTypeMasterController {
  constructor(private leaveTypeMasterService: LeaveTypeMasterService) {}

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.PM, Role.TL, Role.HR)
  @ApiOperation({ summary: 'Get a list of all leave type masters' })
  findAll() {
    return this.leaveTypeMasterService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER, Role.PM, Role.TL, Role.HR)
  @ApiOperation({ summary: 'Get a single leave type master by ID' })
  findOne(@Param('id') id: string) {
    return this.leaveTypeMasterService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new leave type master' })
  create(@Body() dto: CreateLeaveTypeMasterDto) {
    return this.leaveTypeMasterService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update an existing leave type master by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateLeaveTypeMasterDto) {
    return this.leaveTypeMasterService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a leave type master by ID' })
  remove(@Param('id') id: string) {
    return this.leaveTypeMasterService.remove(id);
  }
}
