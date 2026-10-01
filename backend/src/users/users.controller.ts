import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Roles, Permissions } from '../auth/decorators/rbac.decorator';
import { Role, Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkUploadDto } from './dto/bulk-upload.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('team-members')
  @ApiOperation({ summary: 'Get the team members reporting to the current user' })
  findTeamMembers(@CurrentUser() actor: any) {
    return this.usersService.findTeamMembers(actor.userId, actor.role);
  }

  // Minimal list of PM-eligible users for assignment dropdowns (e.g. project
  // creation). Open to any authenticated user; returns no PII. Always includes
  // the current user so a creator can assign themselves as PM.
  @Get('managers')
  findManagers(@CurrentUser() actor: any) {
    return this.usersService.findManagers(actor.userId);
  }

  // List of all active users selectable as resources in allocation dropdowns
  // (e.g. project resource allocation). Open to any authenticated user.
  @Get('allocatable')
  findAllocatable() {
    return this.usersService.findAllocatableResources();
  }

  // Active users assignable to tasks (workforce roles: PM/TL/USER/HR).
  // Open to any authenticated user so PM/TL can pick a task assignee.
  @Get('assignable')
  findAssignable() {
    return this.usersService.findAssignableUsers();
  }

  @Get('task-assignees')
  findTaskAssignees(
    @CurrentUser() actor: any,
    @Query('projectId') projectId?: string,
  ) {
    return this.usersService.findTaskAssignees(actor.userId, actor.role, projectId);
  }

  @Get()
  @Permissions(Permission.USER_READ, Permission.USER_MANAGE)
  findAll(@CurrentUser() actor: any) {
    return this.usersService.findAll(actor.userId, actor.role);
  }

  @Get(':id')
  @Permissions(Permission.USER_READ)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Permissions(Permission.USER_CREATE)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser('userId') actorId: string,
    @Req() req: any,
  ) {
    return this.usersService.create(dto, actorId, req.ip);
  }

  @Patch(':id')
  @Permissions(Permission.USER_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('userId') actorId: string,
    @Req() req: any,
  ) {
    return this.usersService.update(id, dto, actorId, req.ip);
  }

  @Delete(':id')
  @Permissions(Permission.USER_DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser('userId') actorId: string,
    @Req() req: any,
  ) {
    return this.usersService.remove(id, actorId, req.ip);
  }

  @Post(':id/unlock')
  @Permissions(Permission.USER_UPDATE)
  unlock(
    @Param('id') id: string,
    @CurrentUser('userId') actorId: string,
    @Req() req: any,
  ) {
    return this.usersService.unlock(id, actorId, req.ip);
  }

  @Post('bulk-upload')
  @Permissions(Permission.USER_CREATE)
  bulkUpload(
    @Body() dto: BulkUploadDto,
    @CurrentUser('userId') actorId: string,
    @Req() req: any,
  ) {
    return this.usersService.bulkUpload(dto, actorId, req.ip);
  }
}
