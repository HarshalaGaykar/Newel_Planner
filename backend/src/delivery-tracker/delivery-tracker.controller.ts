import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmailLogStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DeliveryTrackerService } from './delivery-tracker.service';
import { ExportService } from '../reports/export.service';
import { TrackerReportHtmlService } from '../reports/tracker-report-html.service';
import { ProjectRecipientsService } from '../project-recipients/project-recipients.service';
import { EmailService } from '../notifications/email.service';
import { EmailLogService } from '../notifications/email-log.service';
import { CreateDeliveryItemDto } from './dto/create-delivery-item.dto';
import { UpdateDeliveryItemDto } from './dto/update-delivery-item.dto';
import { CreateRemarkDto } from './dto/create-remark.dto';
import { SendReportDto } from './dto/send-report.dto';
import { ReportSettingsDto } from './dto/report-settings.dto';

@ApiTags('Delivery Tracker')
@ApiBearerAuth()
@Controller({ path: 'delivery-tracker', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryTrackerController {
  constructor(
    private readonly service: DeliveryTrackerService,
    private readonly exportService: ExportService,
    private readonly reportHtml: TrackerReportHtmlService,
    private readonly recipientsService: ProjectRecipientsService,
    private readonly emailService: EmailService,
    private readonly emailLogService: EmailLogService,
  ) {}

  @Get()
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Get all delivery tracker items for a project' })
  findAll(@Query('projectId') projectId: string) {
    return this.service.findAll(projectId);
  }

  @Get('export')
  @Permissions(Permission.TRACKER_EXPORT)
  @ApiOperation({ summary: 'Export a project delivery tracker as an Excel file' })
  async export(
    @Query('projectId') projectId: string,
    @CurrentUser('userId') userId: string,
    @Res() res: any,
  ) {
    const data = await this.service.getExportData(projectId, userId);
    const buffer = await this.exportService.toTrackerExcel(data);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tracker-${projectId}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('report-settings')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Get the saved report header (date, prepared by, status summary) for a project' })
  reportSettings(@Query('projectId') projectId: string) {
    return this.service.getReportSettings(projectId);
  }

  // Gated on TRACKER_VIEW to match the existing create/update item endpoints —
  // there is no TRACKER_EDIT permission, and adding one needs a seed run.
  @Put('report-settings')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Save the report header fields for a project' })
  saveReportSettings(
    @Query('projectId') projectId: string,
    @Body() dto: ReportSettingsDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.saveReportSettings(projectId, dto, userId);
  }

  @Get('report-history')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'List every delivery tracker report emailed for a project' })
  reportHistory(@Query('projectId') projectId: string) {
    return this.service.getReportHistory(projectId);
  }

  @Get('report-preview')
  @Permissions(Permission.TRACKER_EXPORT)
  @ApiOperation({ summary: 'Preview the status report email (recipients + attachment data) for a project' })
  async reportPreview(@Query('projectId') projectId: string, @CurrentUser('userId') userId: string) {
    const [data, recipients] = await Promise.all([
      this.service.getExportData(projectId, userId),
      this.recipientsService.resolveRecipients(projectId),
    ]);
    return { ...data, ...recipients };
  }

  @Get('report-html')
  @Permissions(Permission.TRACKER_EXPORT)
  @ApiOperation({ summary: 'Render the status report exactly as it will appear in the email body' })
  async reportHtmlPreview(@Query('projectId') projectId: string, @CurrentUser('userId') userId: string) {
    const data = await this.service.getExportData(projectId, userId);
    return { html: this.reportHtml.renderDocument(data) };
  }

  @Post('send-report')
  @Permissions(Permission.TRACKER_EXPORT)
  @ApiOperation({ summary: 'Email the delivery tracker report, rendered into the message body' })
  async sendReport(
    @Query('projectId') projectId: string,
    @Body() dto: SendReportDto,
    @CurrentUser('userId') userId: string,
  ) {
    // Header fields come from the project's saved report settings (edited on the
    // tracker screen). The DTO overrides remain accepted for API callers.
    const data = await this.service.getExportData(projectId, userId);
    const reportDate = dto.reportDate ? new Date(dto.reportDate) : data.reportDate;
    const preparedBy = dto.preparedBy?.trim() || data.preparedBy;
    const statusSummary = dto.statusSummary?.trim() || data.statusSummary;

    const reportData = { ...data, statusSummary, reportDate, preparedBy };

    // The report is the email body now. The workbook is opt-in only, for callers
    // that still want the spreadsheet alongside it.
    const html = this.reportHtml.renderEmail(reportData, dto.body);
    const attachments = dto.includeExcelAttachment
      ? [{
          filename: `tracker-${projectId}.xlsx`,
          content: await this.exportService.toTrackerExcel(reportData),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }]
      : undefined;

    const recipient = dto.to.join(', ');
    const auditBase = {
      projectId,
      sentById: userId,
      preparedBy,
      reportDate,
      recipients: dto.to,
      cc: dto.cc ?? [],
      subject: dto.subject,
      itemCount: data.rows.length,
    };
    try {
      const info = await this.emailService.send(
        recipient,
        dto.subject,
        html,
        dto.cc,
        undefined,
        attachments,
      );
      await this.emailLogService.record({
        kind: 'PROJECT_STATUS_REPORT',
        status: EmailLogStatus.SUCCESS,
        recipient,
        subject: dto.subject,
        templateName: 'delivery-tracker-report',
        messageId: info.messageId,
        metadata: { projectId, cc: dto.cc ?? [] },
      });
      await this.service.recordReportSend({
        ...auditBase,
        status: 'SUCCESS',
        messageId: info.messageId,
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      await this.emailLogService.record({
        kind: 'PROJECT_STATUS_REPORT',
        status: EmailLogStatus.FAILED,
        recipient,
        subject: dto.subject,
        templateName: 'delivery-tracker-report',
        error: error instanceof Error ? error.message : String(error),
        metadata: { projectId, cc: dto.cc ?? [] },
      });
      await this.service.recordReportSend({
        ...auditBase,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestException('Failed to send the report email. Please try again.');
    }
  }

  @Get(':id')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Get a single delivery tracker item by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Create a new delivery tracker item under a project' })
  create(
    @Query('projectId') projectId: string,
    @Body() dto: CreateDeliveryItemDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.create(projectId, dto, userId);
  }

  @Patch(':id')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Update an existing delivery tracker item by ID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryItemDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Delete a delivery tracker item by ID' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/remarks')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Add a remark to a delivery tracker item' })
  addRemark(
    @Param('id') id: string,
    @Body() dto: CreateRemarkDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.addRemark(id, dto, userId);
  }

  @Get(':id/remarks')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Get all remarks for a delivery tracker item' })
  getRemarks(@Param('id') id: string) {
    return this.service.getRemarks(id);
  }

  @Get(':id/history')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Get the change history of a delivery tracker item' })
  getHistory(@Param('id') id: string) {
    return this.service.getHistory(id);
  }
}
