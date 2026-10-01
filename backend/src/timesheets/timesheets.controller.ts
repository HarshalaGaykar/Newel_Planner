import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, Res, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TimesheetsService } from './timesheets.service';
import { CreateWeeklyTimesheetDto, CreateTimesheetEntryDto } from './dto/create-weekly-timesheet.dto';
import { UpdateTimesheetEntryDto } from './dto/update-timesheet-entry.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { QueryTeamSummaryDto } from './dto/query-team-summary.dto';
import { QueryBulkUploadHistoryDto } from './dto/query-bulk-upload-history.dto';

@ApiTags('Timesheets')
@ApiBearerAuth()
@Controller({ path: 'timesheets', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  // ── Timesheet CRUD ────────────────────────────────────────────────────────

  @Get()
  @Permissions(Permission.WORKFORCE_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Get a list of timesheets with optional user, project, status and date-range filters' })
  findAll(
    @CurrentUser() user: any,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timesheetsService.findAll({ id: user.userId, role: user.role }, userId, projectId, status, startDate, endDate);
  }

  // ── Static routes (must come before :id) ─────────────────────────────────

  @Get('missing')
  @Permissions(Permission.REPORT_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Get users with missing timesheets for a given week, optionally filtered by department' })
  getMissingTimesheets(
    @CurrentUser() actor: any,
    @Query('weekStart') weekStart: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.timesheetsService.getMissingTimesheets(actor.userId, actor.role, weekStart, departmentId);
  }

  @Get('backdated-requests')
  @Permissions(Permission.WORKFORCE_TIMESHEET_APPROVE)
  @ApiOperation({ summary: 'Get pending backdated timesheet requests awaiting approval' })
  getBackdatedRequests(@CurrentUser() actor: any) {
    return this.timesheetsService.getBackdatedRequests(actor.userId, actor.role);
  }

  @Get('team-summary')
  @Permissions(Permission.WORKFORCE_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Get a paginated summary of timesheet activity for the current user\'s team' })
  getTeamSummary(@CurrentUser() actor: any, @Query() query: QueryTeamSummaryDto) {
    return this.timesheetsService.getTeamSummary(actor.userId, actor.role, query);
  }

  @Get('team-summary/options')
  @Permissions(Permission.WORKFORCE_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Get the team members selectable in the Team Timesheets filters' })
  getTeamSummaryOptions(@CurrentUser() actor: any) {
    return this.timesheetsService.getTeamSummaryOptions(actor.userId, actor.role);
  }

  @Get('tasks/:taskId/effort-status')
  @Permissions(Permission.WORKFORCE_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Estimate vs logged hours for a task, for the over-run warning in the entry form' })
  getTaskEffortStatus(
    @Param('taskId') taskId: string,
    @Query('incomingHours') incomingHours?: string,
    @Query('excludeEntryId') excludeEntryId?: string,
  ) {
    const hours = Number(incomingHours);
    return this.timesheetsService.getTaskEffortStatus(taskId, {
      incomingHours: Number.isFinite(hours) ? hours : undefined,
      excludeEntryId,
    });
  }

  @Get('settings')
  getSettings() {
    return this.timesheetsService.getSettings();
  }

  @Get('calendar')
  @Permissions(Permission.WORKFORCE_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Get a month of logged hours per day, with the entries behind each day' })
  getCalendar(
    @CurrentUser() actor: any,
    @Query('month') month?: string,
    @Query('userId') userId?: string,
  ) {
    return this.timesheetsService.getCalendarMonth(
      { id: actor.userId, role: actor.role },
      { month, userId },
    );
  }

  // ── Bulk fill (Excel template + upload) ───────────────────────────────────

  @Get('bulk-template')
  @Permissions(Permission.WORKFORCE_TIMESHEET_BULK_UPLOAD)
  @ApiOperation({ summary: 'Download a personal bulk-fill Excel template (your projects, tasks & activities)' })
  async downloadBulkTemplate(@CurrentUser() actor: any, @Res() res: Response) {
    const buffer = await this.timesheetsService.generateBulkTemplate({ id: actor.userId, role: actor.role });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="timesheet-template.xlsx"',
    });
    res.end(buffer);
  }

  @Post('bulk-upload')
  @Permissions(Permission.WORKFORCE_TIMESHEET_BULK_UPLOAD)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Bulk-fill the current user\'s timesheet from a filled Excel/CSV template' })
  bulkUpload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: any,
    @Body('timeZone') timeZone?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.timesheetsService.bulkUploadEntries(file, { id: actor.userId, role: actor.role }, timeZone);
  }

  @Get('bulk-uploads')
  @Permissions(Permission.WORKFORCE_TIMESHEET_BULK_UPLOAD)
  @ApiOperation({ summary: 'List the current user\'s recent timesheet bulk uploads (for undo)' })
  listBulkUploads(@CurrentUser() actor: any) {
    return this.timesheetsService.listBulkUploads({ id: actor.userId, role: actor.role });
  }

  @Get('bulk-upload-history')
  @Permissions(Permission.WORKFORCE_TIMESHEET_BULK_UPLOAD)
  @ApiOperation({ summary: 'Paginated history of the current user\'s timesheet bulk uploads' })
  listBulkUploadHistory(@CurrentUser() actor: any, @Query() query: QueryBulkUploadHistoryDto) {
    return this.timesheetsService.listBulkUploadHistory({ id: actor.userId, role: actor.role }, query.page, query.pageSize);
  }

  @Get('bulk-upload/:batchId/errors')
  @Permissions(Permission.WORKFORCE_TIMESHEET_BULK_UPLOAD)
  @ApiOperation({ summary: 'Row-level errors recorded for one bulk-upload batch' })
  getBulkUploadErrors(@Param('batchId', ParseUUIDPipe) batchId: string, @CurrentUser() actor: any) {
    return this.timesheetsService.getBulkUploadErrors(batchId, { id: actor.userId, role: actor.role });
  }

  @Post('bulk-upload/:batchId/rollback')
  @Permissions(Permission.WORKFORCE_TIMESHEET_BULK_UPLOAD)
  @ApiOperation({ summary: 'Undo a bulk upload — remove only the entries/weeks it created' })
  rollbackBulkUpload(@Param('batchId', ParseUUIDPipe) batchId: string, @CurrentUser() actor: any) {
    return this.timesheetsService.rollbackBulkUpload(batchId, { id: actor.userId, role: actor.role });
  }

  @Post('backdated-requests/:id/approve')
  @Permissions(Permission.WORKFORCE_TIMESHEET_APPROVE)
  approveBackdatedRequest(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheetsService.approveBackdatedRequest(id, user.userId);
  }

  @Post('backdated-requests/:id/reject')
  @Permissions(Permission.WORKFORCE_TIMESHEET_APPROVE)
  rejectBackdatedRequest(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheetsService.rejectBackdatedRequest(id, user.userId);
  }

  // ── Activity Master ───────────────────────────────────────────────────────

  @Get('activity-master')
  @Permissions(Permission.WORKFORCE_TIMESHEET_VIEW)
  findAllActivities(@Query('taskType') taskType?: string) {
    return this.timesheetsService.findAllActivities(taskType);
  }

  @Post('activity-master')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  createActivity(
    @Body()
    body: { taskType: string; activity: string; subActivity: string; meaning?: string },
  ) {
    return this.timesheetsService.createActivity(body);
  }

  @Patch('activity-master/:id')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  updateActivity(
    @Param('id') id: string,
    @Body() body: { activity?: string; subActivity?: string; meaning?: string },
  ) {
    return this.timesheetsService.updateActivity(id, body);
  }

  @Delete('activity-master/:id')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  removeActivity(@Param('id') id: string) {
    return this.timesheetsService.removeActivity(id);
  }

  @Get('missing-entries')
  @Permissions(Permission.WORKFORCE_TIMESHEET_MISSING_VIEW)
  getMissingEntries(
    @CurrentUser() actor: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('userId') userId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.timesheetsService.getMissingEntries(actor.userId, actor.role, { from, to, userId, departmentId });
  }

  // ── Parameterised routes ──────────────────────────────────────────────────

  @Get(':id')
  @Permissions(Permission.WORKFORCE_TIMESHEET_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.timesheetsService.findOne(id);
  }

  @Post('weekly')
  @Permissions(Permission.WORKFORCE_TIMESHEET_CREATE)
  getOrCreateWeekly(@Body() dto: CreateWeeklyTimesheetDto) {
    return this.timesheetsService.getOrCreateWeekly(dto);
  }

  // ── Entries ───────────────────────────────────────────────────────────────

  @Post(':id/entry')
  @Permissions(Permission.WORKFORCE_TIMESHEET_CREATE)
  addEntry(@Param('id') id: string, @Body() entryDto: CreateTimesheetEntryDto, @CurrentUser() actor: any) {
    return this.timesheetsService.addEntry(id, entryDto, actor.role, actor.userId);
  }

  @Patch('entry/:entryId')
  @Permissions(Permission.WORKFORCE_TIMESHEET_CREATE)
  updateEntry(
    @Param('entryId') entryId: string,
    @Body() entryDto: UpdateTimesheetEntryDto,
    @CurrentUser() actor: any,
  ) {
    return this.timesheetsService.updateEntry(entryId, entryDto, actor.role);
  }

  @Delete('entry/:entryId')
  @Permissions(Permission.WORKFORCE_TIMESHEET_CREATE)
  removeEntry(@Param('entryId') entryId: string) {
    return this.timesheetsService.removeEntry(entryId);
  }

  @Post(':id/copy-previous-week')
  @Permissions(Permission.WORKFORCE_TIMESHEET_CREATE)
  copyPreviousWeek(@Param('id') id: string) {
    return this.timesheetsService.copyPreviousWeek(id);
  }

  // ── Workflow ──────────────────────────────────────────────────────────────

  @Patch(':id/submit')
  @Permissions(Permission.WORKFORCE_TIMESHEET_CREATE)
  submit(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.timesheetsService.submit(id, actor.userId, actor.role);
  }

  @Patch(':id/approve-ra')
  @Permissions(Permission.WORKFORCE_TIMESHEET_APPROVE)
  raApprove(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.timesheetsService.raApprove(id, actor.userId, actor.role);
  }

  @Patch(':id/approve-pm')
  @Permissions(Permission.WORKFORCE_TIMESHEET_APPROVE)
  pmApprove(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.timesheetsService.pmApprove(id, actor.userId, actor.role);
  }

  @Patch(':id/reject')
  @Permissions(Permission.WORKFORCE_TIMESHEET_APPROVE)
  reject(@Param('id') id: string, @Body() dto: RejectTimesheetDto, @CurrentUser() actor: any) {
    return this.timesheetsService.reject(id, actor.userId, actor.role, dto?.remarks ?? '');
  }
}

