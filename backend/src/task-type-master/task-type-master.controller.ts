import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskTypeMasterService } from './task-type-master.service';
import { CreateTaskTypeDto } from './dto/create-task-type.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateSubActivityDto } from './dto/create-sub-activity.dto';
import { UpdateTaskTypeDto } from './dto/update-task-type.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateSubActivityDto } from './dto/update-sub-activity.dto';

@ApiTags('Task Type Master')
@ApiBearerAuth()
@Controller('task-type-master')
@UseGuards(JwtAuthGuard)
export class TaskTypeMasterController {
  constructor(private readonly service: TaskTypeMasterService) {}

  // ── Read (all authenticated users) ──────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get the full task type master tree, optionally including inactive entries' })
  getTree(@Query('includeInactive') includeInactive?: string) {
    return this.service.getTree(includeInactive === 'true');
  }

  @Get(':taskTypeId/activities')
  @ApiOperation({ summary: 'Get all activities for a given task type' })
  getActivities(
    @Param('taskTypeId', ParseUUIDPipe) taskTypeId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getActivitiesForTaskType(taskTypeId, includeInactive === 'true');
  }

  @Get('activities/:activityId/sub-activities')
  @ApiOperation({ summary: 'Get all sub-activities for a given activity' })
  getSubActivities(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getSubActivitiesForActivity(activityId, includeInactive === 'true');
  }

  // ── Write (ADMIN_CONFIG_EDIT) ─────────────────────────────────────────────

  @Post('task-types')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Create a new task type' })
  createTaskType(@Body() dto: CreateTaskTypeDto, @CurrentUser('userId') userId: string) {
    return this.service.createTaskType(dto, userId);
  }

  @Post('activities')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Create a new activity under a task type' })
  createActivity(@Body() dto: CreateActivityDto, @CurrentUser('userId') userId: string) {
    return this.service.createActivity(dto, userId);
  }

  @Post('sub-activities')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Create a new sub-activity under an activity' })
  createSubActivity(@Body() dto: CreateSubActivityDto, @CurrentUser('userId') userId: string) {
    return this.service.createSubActivity(dto, userId);
  }

  @Post('bulk-upload')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv',
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|csv)$/i)) {
          cb(null, true);
        } else {
          cb(new Error('Only .xlsx and .csv files are accepted'), false);
        }
      },
    }),
  )
  @ApiOperation({ summary: 'Bulk upload task types, activities and sub-activities from an Excel or CSV file' })
  bulkUpload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) throw new Error('No file uploaded');
    return this.service.bulkUpload(file, userId);
  }

  @Patch('task-types/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Update an existing task type by ID' })
  updateTaskType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskTypeDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.updateTaskType(id, dto, userId);
  }

  @Patch('activities/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Update an existing activity by ID' })
  updateActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.updateActivity(id, dto, userId);
  }

  @Patch('sub-activities/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Update an existing sub-activity by ID' })
  updateSubActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubActivityDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.updateSubActivity(id, dto, userId);
  }
}
