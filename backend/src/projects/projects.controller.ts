import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) { }

  // No @Permissions here: PROJECT_CREATE is role-based and can't target Reporting
  // Authorities (RA is not a role). Authorization (ADMIN/PM/TL or RA) is enforced
  // in projects.service.create() instead.
  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @CurrentUser() user: any) {
    return this.projectsService.create(createProjectDto, { id: user.userId, role: user.role });
  }

  // @Get()
  // @Permissions(Permission.PROJECT_LIST_VIEW, Permission.WORKFORCE_TIMESHEET_CREATE)
  // findAll(
  //   @CurrentUser() user: any,
  //   @Query('status') status?: string,
  //   @Query('type') type?: string,
  //   @Query('clientId') clientId?: string,
  // ) {
  //   return this.projectsService.findAll(
  //     { id: user.userId, role: user.role },
  //     { status, type, clientId },
  //   );
  // }
  @Get()
  @Permissions(Permission.PROJECT_LIST_VIEW, Permission.WORKFORCE_TIMESHEET_CREATE)
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
  ) {
    return this.projectsService.findAll(
      { id: user.userId, role: user.role },
      { status, type, clientId, search },
    );
  }

  @Get(':id')
  @Permissions(Permission.PROJECT_LIST_VIEW, Permission.WORKFORCE_TIMESHEET_CREATE)
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.PROJECT_CREATE) // Usually PM or Admin can update projects
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto, @CurrentUser() user: any) {
    return this.projectsService.update(id, updateProjectDto, { id: user.userId, role: user.role });
  }

  @Delete(':id')
  @Permissions(Permission.PROJECT_CREATE) // Or a specific PROJECT_DELETE if needed
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Get(':id/burn-rate')
  @Permissions(Permission.REPORT_PROJECT_VIEW)
  getBurnRate(@Param('id') id: string) {
    return this.projectsService.getBurnRate(id);
  }

  @Get(':id/margin')
  @Permissions(Permission.FINANCIAL_DASHBOARD_VIEW)
  getMargin(@Param('id') id: string) {
    return this.projectsService.getMargin(id);
  }
}

