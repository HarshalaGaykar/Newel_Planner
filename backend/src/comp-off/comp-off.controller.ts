import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CompOffService } from './comp-off.service';
import { CreateCompOffDto } from './dto/create-comp-off.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Comp Off')
@ApiBearerAuth()
@Controller({ path: 'comp-off', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CompOffController {
  constructor(private service: CompOffService) {}

  @Get()
  @Permissions(Permission.COMPOFF_READ, Permission.COMPOFF_MANAGE)
  @ApiOperation({ summary: 'Get a list of comp-off requests, optionally filtered by user' })
  findAll(@CurrentUser() actor: any, @Query('userId') userId?: string) {
    return this.service.findAll(actor.userId, actor.role, userId);
  }

  @Get(':id')
  @Permissions(Permission.COMPOFF_READ, Permission.COMPOFF_MANAGE)
  @ApiOperation({ summary: 'Get a single comp-off request by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(Permission.COMPOFF_REQUEST)
  @ApiOperation({ summary: 'Create a new comp-off request' })
  create(@CurrentUser() actor: any, @Body() dto: CreateCompOffDto) {
    return this.service.create(dto, actor.userId, actor.role);
  }

  @Patch(':id/approve')
  @Permissions(Permission.COMPOFF_READ, Permission.COMPOFF_APPROVE, Permission.COMPOFF_MANAGE)
  @ApiOperation({ summary: 'Approve a comp-off request by ID' })
  approve(@CurrentUser() actor: any, @Param('id') id: string) {
    return this.service.approve(id, actor.userId, actor.role);
  }

  @Patch(':id/reject')
  @Permissions(Permission.COMPOFF_READ, Permission.COMPOFF_APPROVE, Permission.COMPOFF_MANAGE)
  @ApiOperation({ summary: 'Reject a comp-off request by ID' })
  reject(@CurrentUser() actor: any, @Param('id') id: string) {
    return this.service.reject(id, actor.userId, actor.role);
  }

  @Patch(':id/utilise')
  @Permissions(Permission.COMPOFF_READ, Permission.COMPOFF_MANAGE)
  @ApiOperation({ summary: 'Mark an approved comp-off request as utilised' })
  markUtilised(@CurrentUser() actor: any, @Param('id') id: string) {
    return this.service.markUtilised(id, actor.userId, actor.role);
  }

  @Delete(':id')
  @Permissions(Permission.COMPOFF_REQUEST, Permission.COMPOFF_MANAGE)
  @ApiOperation({ summary: 'Delete a comp-off request by ID' })
  remove(@CurrentUser() actor: any, @Param('id') id: string) {
    return this.service.remove(id, actor.userId, actor.role);
  }
}
