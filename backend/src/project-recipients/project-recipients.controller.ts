import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { ProjectRecipientsService } from './project-recipients.service';
import { SetProjectRecipientsDto } from './dto/set-project-recipients.dto';

@ApiTags('Project Recipients')
@ApiBearerAuth()
@Controller({ path: 'project-recipients', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectRecipientsController {
  constructor(private readonly service: ProjectRecipientsService) {}

  @Get(':projectId')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Get recipient options and current To/CC mapping for a project' })
  get(@Param('projectId') projectId: string) {
    return this.service.getOptionsAndMapping(projectId);
  }

  @Put(':projectId')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Replace the To/CC recipient mapping for a project' })
  set(@Param('projectId') projectId: string, @Body() dto: SetProjectRecipientsDto) {
    return this.service.setRecipients(projectId, dto);
  }
}
