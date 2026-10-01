import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, Res, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskUploadHistoryDto } from './dto/query-task-upload-history.dto';
import { QueryTaskBulkUploadHistoryDto } from './dto/query-task-bulk-upload-history.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task under a project' })
  create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(createTaskDto, { id: user.userId, role: user.role });
  }

  @Get('wbs-template')
  @Permissions(Permission.WORK_TASK_IMPORT)
  @ApiOperation({ summary: 'Download the WBS import Excel template' })
  async downloadWbsTemplate(@Res() res: Response) {
    const buffer = await this.tasksService.generateWbsTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="wbs-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('wbs-upload')
  @Permissions(Permission.WORK_TASK_IMPORT)
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
  @ApiOperation({ summary: 'Upload a WBS file to import tasks for a project' })
  uploadWbs(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectId: string,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new Error('No file uploaded');
    return this.tasksService.uploadWbs(file, projectId, { id: user.userId, role: user.role });
  }

  @Get('wbs-upload-history')
  @Permissions(Permission.WORK_TASK_IMPORT)
  @ApiOperation({ summary: 'List paginated WBS upload history for a project (for undo)' })
  getWbsUploadHistory(@Query() query: QueryTaskUploadHistoryDto) {
    return this.tasksService.getWbsUploadHistory(query.projectId, query);
  }

  @Get('wbs-upload-history/:batchId/errors')
  @Permissions(Permission.WORK_TASK_IMPORT)
  @ApiOperation({ summary: 'Row-level errors for one WBS upload batch' })
  getWbsUploadErrors(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.tasksService.getWbsUploadErrors(batchId);
  }

  @Post('wbs-upload-history/:batchId/undo')
  @Permissions(Permission.WORK_TASK_IMPORT)
  @ApiOperation({ summary: 'Undo a WBS upload — deletes only the tasks it created; blocked if any have logged timesheet hours' })
  undoWbsUpload(@Param('batchId', ParseUUIDPipe) batchId: string, @CurrentUser() user: any) {
    return this.tasksService.undoWbsUpload(batchId, { id: user.userId, role: user.role });
  }

  @Get('task-template')
  @Permissions(Permission.WORK_TASK_IMPORT)
  @ApiOperation({ summary: 'Download the task bulk-import Excel template' })
  async downloadTaskTemplate(@Res() res: Response) {
    const buffer = await this.tasksService.generateTaskTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="task-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('bulk-upload')
  @Permissions(Permission.WORK_TASK_IMPORT)
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
  @ApiOperation({ summary: 'Bulk upload tasks from an Excel or CSV file' })
  bulkUpload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (!file) throw new Error('No file uploaded');
    return this.tasksService.bulkUploadTasks(file, { id: user.userId, role: user.role });
  }

  @Get('bulk-upload-history')
  @Permissions(Permission.WORK_TASK_IMPORT)
  @ApiOperation({ summary: 'List paginated Task Board bulk upload history (for undo)' })
  getBulkUploadHistory(@Query() query: QueryTaskBulkUploadHistoryDto) {
    return this.tasksService.getBulkUploadHistory(query);
  }

  @Get('bulk-upload/:batchId/errors')
  @Permissions(Permission.WORK_TASK_IMPORT)
  @ApiOperation({ summary: 'Row-level errors for one Task Board bulk upload batch' })
  getBulkUploadErrors(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.tasksService.getBulkUploadErrors(batchId);
  }

  @Post('bulk-upload/:batchId/undo')
  @Permissions(Permission.WORK_TASK_IMPORT)
  @ApiOperation({ summary: 'Undo a Task Board bulk upload — deletes only the tasks it created; blocked if any have logged timesheet hours' })
  undoBulkUpload(@Param('batchId', ParseUUIDPipe) batchId: string, @CurrentUser() user: any) {
    return this.tasksService.undoBulkUpload(batchId, { id: user.userId, role: user.role });
  }

  @Get('critical-path')
  @ApiOperation({ summary: 'Get the critical path of tasks for a project' })
  getCriticalPath(@Query('projectId') projectId: string) {
    return this.tasksService.getCriticalPath(projectId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export the current task board view to Excel, honoring the active filters' })
  async exportTasks(
    @CurrentUser() user: any,
    @Res() res: Response,
    @Query('projectId') projectId?: string,
    @Query('milestoneId') milestoneId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: string,
    @Query('crId') crId?: string,
    @Query('parentId') parentId?: string,
  ) {
    const buffer = await this.tasksService.exportTasks(
      { id: user.userId, role: user.role },
      projectId, milestoneId, assigneeId, status, crId, parentId,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tasks.xlsx"',
    });
    res.send(buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of tasks with optional filters' })
  findAll(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
    @Query('milestoneId') milestoneId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: string,
    @Query('crId') crId?: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.tasksService.findAll({ id: user.userId, role: user.role }, projectId, milestoneId, assigneeId, status, crId, parentId);
  }

  @Get('my-scope')
  @ApiOperation({ summary: 'Get tasks within the current PM or TL user scope' })
  findAllForPmTl(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
  ) {
    if (!['PM', 'TL'].includes(user.role)) {
      throw new ForbiddenException('Only PM and TL roles can access this endpoint');
    }
    return this.tasksService.findAllForPmTl({ id: user.userId, role: user.role }, projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single task by ID' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing task by ID' })
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.update(id, updateTaskDto, { id: user.userId, role: user.role });
  }

  @Patch(':id/progress')
  @ApiOperation({ summary: 'Update the progress percentage of a task by ID' })
  updateProgress(@Param('id') id: string, @Body('progressPct') progressPct: number, @CurrentUser() user: any) {
    return this.tasksService.updateProgress(id, progressPct, user?.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task by ID' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.remove(id, user?.userId);
  }
}
