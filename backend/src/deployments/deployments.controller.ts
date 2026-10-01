import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DeploymentsService } from './deployments.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentDto } from './dto/update-deployment.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Deployments')
@ApiBearerAuth()
@Controller({ path: 'deployments', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeploymentsController {
  constructor(private service: DeploymentsService) {}

  @Post()
  @Permissions(Permission.PROJECT_MANAGE) // Assuming this is enough for deployments
  @ApiOperation({ summary: 'Create a new deployment for a project' })
  create(@Body() dto: CreateDeploymentDto, @CurrentUser('userId') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions(Permission.PROJECT_READ)
  @ApiOperation({ summary: 'Get a list of deployments, optionally filtered by project' })
  findAll(@Query('projectId') projectId?: string) {
    return this.service.findAll(projectId);
  }

  @Get(':id')
  @Permissions(Permission.PROJECT_READ)
  @ApiOperation({ summary: 'Get a single deployment by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.PROJECT_MANAGE)
  @ApiOperation({ summary: 'Update an existing deployment by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateDeploymentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.PROJECT_MANAGE)
  @ApiOperation({ summary: 'Delete a deployment by ID' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
