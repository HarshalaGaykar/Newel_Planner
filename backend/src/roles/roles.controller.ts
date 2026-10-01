import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Roles, Permissions } from '../auth/decorators/rbac.decorator';
import { Role, Permission } from '../auth/constants/rbac.constants';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller({ path: 'roles', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @Permissions(Permission.ADMIN_ROLE_VIEW, Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Get a list of all roles' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.ADMIN_ROLE_VIEW, Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Get a single role by ID' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Permissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Create a new role with optional permissions' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @Permissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Update an existing role by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Delete a role by ID' })
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
