import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { TimesheetReportQueryDto } from './dto/timesheet-report-query.dto';
import { TimesheetEntriesQueryDto } from './dto/timesheet-entries-query.dto';
import { MonthlyEffortsQueryDto } from './dto/monthly-efforts-query.dto';
import { MonthlyAttendanceQueryDto } from './dto/monthly-attendance-query.dto';
import { NonComplianceQueryDto } from './dto/non-compliance-query.dto';

// Shared by every endpoint below that has no single obvious owning report
// permission (cross-report meta/lookup endpoints, plus a few operational
// reports that predate any report-specific permission). Holding *any* report
// permission is enough — this only gates "is this an authenticated report
// consumer at all", it isn't meant to be a fine-grained check on its own.
const ANY_REPORT_PERMISSION = [
  Permission.REPORT_TIMESHEET_VIEW,
  Permission.REPORT_PROJECT_VIEW,
  Permission.REPORT_UTILIZATION_VIEW,
  Permission.REPORT_ALL_VIEW,
  Permission.REPORT_LEAVE_VIEW,
  Permission.REPORT_ATTENDANCE_VIEW,
  Permission.REPORT_TIMESHEET_DETAILED_VIEW,
  Permission.REPORT_MONTHLY_EFFORTS_VIEW,
  Permission.REPORT_MONTHLY_ATTENDANCE_VIEW,
  Permission.REPORT_NON_COMPLIANCE_VIEW,
];

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
  ) {}

  // ─── Existing Endpoints ─────────────────────────────────────────────────────

  @Get('timesheets')
  @Permissions(Permission.REPORT_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Get a timesheet report filtered by date range, project, user, or status' })
  getTimesheetReport(@Query() filters: ReportFiltersDto) {
    return this.reportsService.getTimesheetReport(filters);
  }

  @Get('timesheets/paginated')
  @Permissions(Permission.REPORT_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Get a page of the timesheet report, filtered by date range, project or user' })
  getTimesheetReportPaginated(@Query() filters: TimesheetReportQueryDto) {
    return this.reportsService.getTimesheetReportPaginated(filters);
  }

  @Get('utilization')
  @Permissions(Permission.REPORT_UTILIZATION_VIEW)
  @ApiOperation({ summary: 'Get a resource utilization report with logged vs target hours' })
  getUtilizationReport(@Query() filters: ReportFiltersDto) {
    return this.reportsService.getUtilizationReport(filters);
  }

  @Get('project-summary')
  @Permissions(Permission.REPORT_PROJECT_VIEW)
  @ApiOperation({ summary: 'Get a summary report of projects with task, ticket, and revenue totals' })
  getProjectSummaryReport(@Query() filters: ReportFiltersDto) {
    return this.reportsService.getProjectSummaryReport(filters);
  }

  @Get('export/project-summary')
  @Permissions(Permission.REPORT_PROJECT_VIEW)
  @ApiOperation({ summary: 'Export the project summary report as a CSV file' })
  async exportProjectSummary(@Query() filters: ReportFiltersDto, @Res() res: any) {
    const data = await this.reportsService.getProjectSummaryReport(filters);
    const headers = ['id', 'name', 'status', 'type', 'taskCount', 'ticketCount', 'totalRevenue'];
    const csv = await this.reportsService.exportToCsv(data, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=project-summary.csv');
    return res.send(csv);
  }

  @Get('export/timesheets')
  @Permissions(Permission.REPORT_TIMESHEET_VIEW)
  @ApiOperation({ summary: 'Export the timesheet report as a CSV file' })
  async exportTimesheets(@Query() filters: ReportFiltersDto, @Res() res: any) {
    const data = await this.reportsService.getTimesheetReport(filters);

    const flattenedData = data.map(entry => ({
      date: entry.date.toISOString().split('T')[0],
      project: entry.project.name,
      user: entry.timesheet.user?.email ?? 'freelancer',
      role: entry.roleName ?? '',
      maturity: entry.maturityValue ?? '',
      hours: entry.hours,
      task: entry.task?.title || entry.ticket?.title || 'N/A',
      description: entry.description || ''
    }));

    const headers = ['date', 'project', 'user', 'role', 'maturity', 'hours', 'task', 'description'];
    const csv = await this.reportsService.exportToCsv(flattenedData, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=timesheet-report.csv');
    return res.send(csv);
  }

  @Get('export/utilization')
  @Permissions(Permission.REPORT_UTILIZATION_VIEW)
  @ApiOperation({ summary: 'Export the utilization report as a CSV file' })
  async exportUtilization(@Query() filters: ReportFiltersDto, @Res() res: any) {
    const data = await this.reportsService.getUtilizationReport(filters);

    const flattenedData = data.map((entry) => ({
      resource: `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim(),
      email: entry.email,
      department: entry.department,
      type: entry.type,
      loggedHours: entry.loggedHours,
      targetHours: entry.targetHours,
      utilization: entry.utilization,
      status:
        entry.utilization > 100
          ? 'Over-utilized'
          : entry.utilization > 75
            ? 'Optimal'
            : 'Under-utilized',
    }));

    const headers = [
      'resource',
      'email',
      'department',
      'type',
      'loggedHours',
      'targetHours',
      'utilization',
      'status',
    ];
    const csv = await this.reportsService.exportToCsv(flattenedData, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=utilization-report.csv');
    return res.send(csv);
  }

  // ─── Meta Endpoints ─────────────────────────────────────────────────────────

  @Get('meta/departments')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get the list of departments for report filters' })
  getDepartments() {
    return this.reportsService.getDepartments();
  }

  @Get('meta/projects')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get the list of projects for report filters' })
  getProjectsList() {
    return this.reportsService.getProjectsList();
  }

  @Get('meta/financial-years')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get the list of financial years for report filters' })
  getFinancialYears() {
    return this.reportsService.getFinancialYears();
  }

  @Get('meta/vendors')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get the list of vendors for report filters' })
  getVendorsList() {
    return this.reportsService.getVendorsList();
  }

  @Get('meta/freelancers')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get the list of freelancers for report filters' })
  getFreelancersList() {
    return this.reportsService.getFreelancersList();
  }

  @Get('meta/employees')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get the list of employees for report filters' })
  getEmployeesList(@Query('departmentId') departmentId?: string) {
    return this.reportsService.getEmployeesList(departmentId);
  }

  // ─── Operational Report Endpoints ───────────────────────────────────────────

  @Get('missing-timesheets')
  @Permissions(Permission.WORKFORCE_TIMESHEET_MISSING_VIEW)
  @ApiOperation({ summary: 'Get employees with missing timesheets for a week, optionally exported to Excel' })
  async getMissingTimesheets(
    @Query('weekStart') weekStart: string,
    @Query('departmentId') departmentId: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    const startDate = weekStart ? new Date(weekStart) : (() => {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const result = await this.reportsService.getMissingTimesheets(startDate, departmentId || undefined);

    if (exportType === 'excel') {
      const cols = [
        { header: 'Employee Code', key: 'employeeCode' },
        { header: 'Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Department', key: 'department' },
        { header: 'Manager', key: 'manager' },
      ];
      const buffer = await this.exportService.toExcel('Missing Timesheets', cols, result.rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="missing-timesheets.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  @Get('pending-approvals')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get pending approvals older than a given number of days, optionally exported to Excel' })
  async getPendingApprovals(
    @Query('olderThanDays') olderThanDays: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    const days = olderThanDays ? parseInt(olderThanDays, 10) : undefined;
    const result = await this.reportsService.getPendingApprovals(days);

    if (exportType === 'excel') {
      const cols = [
        { header: 'Module', key: 'module' },
        { header: 'Entity Ref', key: 'entityRef' },
        { header: 'Requested By', key: 'requestedBy' },
        { header: 'Requested At', key: 'requestedAt' },
        { header: 'Age (Days)', key: 'ageDays' },
        { header: 'Current Step', key: 'currentStep' },
        { header: 'Current Approver', key: 'currentApprover' },
      ];
      const buffer = await this.exportService.toExcel('Pending Approvals', cols, result.rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="pending-approvals.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  @Get('over-allocation')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get resources booked on more than one allocation on a given date, optionally exported to Excel' })
  async getOverAllocation(
    @Query('date') date: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    const checkDate = date ? new Date(date) : undefined;
    const result = await this.reportsService.getOverAllocationReport(checkDate);

    if (exportType === 'excel') {
      const cols = [
        { header: 'Employee Code', key: 'employeeCode' },
        { header: 'Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Allocation Count', key: 'allocationCount' },
        { header: 'Projects', key: 'allocationSummary' },
      ];
      const buffer = await this.exportService.toExcel('Allocation Conflicts', cols, result);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="allocation-conflicts.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  @Get('leave-calendar')
  @Permissions(Permission.REPORT_LEAVE_VIEW)
  @ApiOperation({ summary: 'Get a monthly leave calendar by department, optionally exported to Excel' })
  async getLeaveCalendar(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('departmentId') departmentId: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const result = await this.reportsService.getLeaveCalendar(m, y, departmentId || undefined);

    if (exportType === 'excel') {
      const flatRows: { date: string; employee: string; leaveType: string }[] = [];
      for (const day of result.days) {
        for (const emp of day.employees) {
          flatRows.push({ date: day.date, employee: emp.name, leaveType: emp.leaveType });
        }
      }
      const cols = [
        { header: 'Date', key: 'date' },
        { header: 'Employee', key: 'employee' },
        { header: 'Leave Type', key: 'leaveType' },
      ];
      const buffer = await this.exportService.toExcel('Leave Calendar', cols, flatRows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="leave-calendar.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  @Get('planned-vs-actual')
  @Permissions(Permission.REPORT_PROJECT_VIEW)
  @ApiOperation({ summary: 'Get planned vs actual hours and dates for a project, optionally exported to Excel' })
  async getPlannedVsActual(
    @Query('projectId') projectId: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    if (!projectId) return res.status(400).json({ message: 'projectId is required' });

    const result = await this.reportsService.getPlannedVsActual(projectId);

    if (exportType === 'excel') {
      const cols = [
        { header: 'Task', key: 'taskTitle' },
        { header: 'Planned Hours', key: 'plannedHours' },
        { header: 'Actual Hours', key: 'actualHours' },
        { header: 'Variance (h)', key: 'variance' },
        { header: 'Variance %', key: 'variancePct' },
        { header: 'Planned End', key: 'plannedEnd' },
        { header: 'Actual End', key: 'actualEnd' },
        { header: 'Delay (days)', key: 'delayDays' },
      ];
      const buffer = await this.exportService.toExcel('Planned vs Actual', cols, result.tasks);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="planned-vs-actual.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  @Get('milestone-delays')
  @Permissions(Permission.REPORT_PROJECT_VIEW)
  @ApiOperation({ summary: 'Get delayed project milestones, optionally exported to Excel' })
  async getMilestoneDelays(
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    const result = await this.reportsService.getMilestoneDelays();

    if (exportType === 'excel') {
      const cols = [
        { header: 'Project', key: 'project' },
        { header: 'Project Code', key: 'projectCode' },
        { header: 'Milestone', key: 'milestone' },
        { header: 'Status', key: 'status' },
        { header: 'Due Date', key: 'dueDate' },
        { header: 'Delay (days)', key: 'delayDays' },
        { header: 'Amount', key: 'amount' },
        { header: 'PM', key: 'pm' },
        { header: 'PM Email', key: 'pmEmail' },
      ];
      const buffer = await this.exportService.toExcel('Milestone Delays', cols, result.rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="milestone-delays.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  @Get('margin-by-project')
  @Permissions(Permission.REPORT_PROJECT_VIEW)
  @ApiOperation({ summary: 'Get profit margin per project for a financial year, optionally exported to Excel' })
  async getMarginByProject(
    @Query('financialYearId') financialYearId: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    const result = await this.reportsService.getMarginByProject(financialYearId || undefined);

    if (exportType === 'excel') {
      const cols = [
        { header: 'Project Code', key: 'projectCode' },
        { header: 'Project', key: 'name' },
        { header: 'Client', key: 'client' },
        { header: 'Status', key: 'status' },
        { header: 'Revenue', key: 'revenue' },
        { header: 'Employee Cost', key: 'employeeCost' },
        { header: 'Freelancer Cost', key: 'freelancerCost' },
        { header: 'Overhead Cost', key: 'overheadCost' },
        { header: 'Total Cost', key: 'totalCost' },
        { header: 'Margin', key: 'margin' },
        { header: 'Margin %', key: 'marginPct' },
      ];
      const buffer = await this.exportService.toExcel('Margin by Project', cols, result);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="margin-by-project.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  @Get('freelancer-spend')
  @Permissions(...ANY_REPORT_PERMISSION)
  @ApiOperation({ summary: 'Get freelancer spend within a date range filtered by vendor or freelancer, optionally exported to Excel' })
  async getFreelancerSpend(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('vendorId') vendorId: string,
    @Query('freelancerId') freelancerId: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const result = await this.reportsService.getFreelancerSpend(
      new Date(startDate),
      new Date(endDate),
      vendorId || undefined,
      freelancerId || undefined,
    );

    if (exportType === 'excel') {
      const cols = [
        { header: 'Freelancer Code', key: 'freelancerCode' },
        { header: 'Name', key: 'name' },
        { header: 'Vendor', key: 'vendor' },
        { header: 'Currency', key: 'currency' },
        { header: 'Cost/Hour', key: 'costPerHour' },
        { header: 'Total Hours', key: 'totalHours' },
        { header: 'Total Cost', key: 'totalCost' },
        { header: 'Projects', key: 'projectSummary' },
      ];
      const buffer = await this.exportService.toExcel('Freelancer Spend', cols, result.freelancers);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="freelancer-spend.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  @Get('resource-availability')
  @Permissions(Permission.REPORT_UTILIZATION_VIEW)
  @ApiOperation({ summary: 'Get resource availability with allocated and available capacity' })
  async getResourceAvailability(@Query() filters: ReportFiltersDto) {
    return this.reportsService.getResourceAvailabilityReport(filters);
  }

  @Get('export/resource-availability')
  @Permissions(Permission.REPORT_UTILIZATION_VIEW)
  @ApiOperation({ summary: 'Export the resource availability report as an Excel file' })
  async exportResourceAvailability(
    @Query() filters: ReportFiltersDto,
    @Res() res: any,
  ) {
    const result = await this.reportsService.getResourceAvailabilityReport(filters);

    const cols = [
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Role', key: 'role' },
      { header: 'Department', key: 'department' },
      { header: 'Allocated %', key: 'allocatedPct' },
      { header: 'Available %', key: 'availablePct' },
    ];

    const buffer = await this.exportService.toExcel('Resource Availability', cols, result);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="resource-availability.xlsx"');
    return res.send(buffer);
  }

  // ─── Detailed Timesheet-Entries Report (dynamic filters, paginated + Excel export) ──

  @Get('timesheets/detailed/paginated')
  @Permissions(Permission.REPORT_TIMESHEET_DETAILED_VIEW)
  @ApiOperation({
    summary:
      'Get a page of the detailed timesheet-entries report. Every filter is optional ' +
      '(active/inactive user, user/project name, hours, planned effort, timesheet date, ' +
      'created date) — an empty query returns the full, unfiltered dataset, one page at a time.',
  })
  getTimesheetEntriesReport(@Query() filters: TimesheetEntriesQueryDto) {
    return this.reportsService.getTimesheetReportDetailedPaginated(filters);
  }

  @Get('export/timesheets-detailed')
  @Permissions(Permission.REPORT_TIMESHEET_DETAILED_EXPORT)
  @ApiOperation({ summary: 'Export the detailed timesheet-entries report (filtered or unfiltered) as an Excel file' })
  async exportTimesheetsDetailed(@Query() filters: TimesheetEntriesQueryDto, @Res() res: any) {
    await this.reportsService.assertExportableRowCount(filters, 'Timesheet detailed report');
    const rows = await this.reportsService.getTimesheetReportDetailed(filters);
    const cols = [
      { header: 'created_by', key: 'created_by' },
      { header: 'projectid', key: 'projectid' },
      { header: 'username', key: 'username' },
      { header: 'role', key: 'role' },
      { header: 'maturity', key: 'maturity' },
      { header: 'projectname', key: 'projectname' },
      { header: 'taskid', key: 'taskid' },
      { header: 'taskname', key: 'taskname' },
      { header: 'tasktype', key: 'tasktype' },
      { header: 'activity', key: 'activity' },
      { header: 'description', key: 'description' },
      { header: 'timespend', key: 'timespend', numFmt: '0.00' },
      { header: 'effortsplanned', key: 'effortsplanned', numFmt: '0.00' },
      { header: 'timesheetdate', key: 'timesheetdate' },
      { header: 'timesheetcreateddate', key: 'timesheetcreateddate' },
      { header: 'timesheet_submission_delay', key: 'timesheet_submission_delay' },
    ];
    const buffer = await this.exportService.toExcel('Timesheet Report', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="timesheet-report.xlsx"');
    return res.send(buffer);
  }

  // ─── Leave Report (3-sheet Excel) ───────────────────────────────────────────

  @Get('leave-report')
  @Permissions(Permission.REPORT_LEAVE_VIEW)
  @ApiOperation({ summary: 'Get a monthly leave report by department and employee, optionally exported to a multi-sheet Excel file' })
  async getLeaveReport(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('departmentId') departmentId: string,
    @Query('userId') userId: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const result = await this.reportsService.getLeaveReport(m, y, departmentId || undefined, userId || undefined);

    if (exportType === 'excel') {
      const buffer = await this.exportService.toMultiSheetExcel([
        {
          name: 'Summary by Department',
          columns: [
            { header: 'Department', key: 'department' },
            { header: 'Headcount', key: 'headcount' },
            { header: 'Total Leave Days', key: 'totalLeaveDays' },
            { header: 'Paid Leave Days', key: 'paidDays' },
            { header: 'Leave Utilization %', key: 'utilizationPct' },
            { header: 'Sandwich Days', key: 'sandwichDays' },
            { header: 'Top Leave Type', key: 'topLeaveType' },
            { header: 'Pending Approvals', key: 'pendingApprovals' },
          ],
          rows: result.summary,
        },
        {
          name: 'Individual Leave Register',
          columns: [
            { header: 'Employee Name', key: 'employeeName' },
            { header: 'Email', key: 'email' },
            { header: 'Department', key: 'department' },
            { header: 'Reporting Authority', key: 'reportingAuthority' },
            { header: 'Leave Type', key: 'leaveType' },
            { header: 'Start Date', key: 'startDate' },
            { header: 'End Date', key: 'endDate' },
            { header: 'Total Days', key: 'totalDays' },
            { header: 'Half-day (AM/PM)', key: 'halfDay' },
            { header: 'Status', key: 'status' },
            { header: 'Reason', key: 'reason' },
            { header: 'Application Date', key: 'applicationDate' },
          ],
          rows: result.register,
        },
        {
          name: 'Carry-Forward & Expiry',
          columns: [
            { header: 'Employee', key: 'employee' },
            { header: 'Email', key: 'email' },
            { header: 'Leave Type', key: 'leaveType' },
            { header: 'Earned', key: 'earned' },
            { header: 'Used', key: 'used' },
            { header: 'Available', key: 'available' },
            { header: 'Carried Forward', key: 'carriedForward' },
            { header: 'Expiry Date', key: 'expiryDate' },
            { header: 'Days Expiring Soon (90d)', key: 'daysExpiringSoon' },
          ],
          rows: result.carryForward,
        },
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="leave-report.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  // ─── Attendance / Clock-In Report (3-sheet Excel) ───────────────────────────

  @Get('attendance-report')
  @Permissions(Permission.REPORT_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Get a monthly attendance and clock-in report by department, optionally exported to a multi-sheet Excel file' })
  async getAttendanceReport(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('departmentId') departmentId: string,
    @Query('export') exportType: string,
    @Res() res: any,
  ) {
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const result = await this.reportsService.getAttendanceReport(m, y, departmentId || undefined);

    if (exportType === 'excel') {
      const buffer = await this.exportService.toMultiSheetExcel([
        {
          name: 'Daily Attendance Summary',
          columns: [
            { header: 'Date', key: 'date' },
            { header: 'Total Employees', key: 'totalEmployees' },
            { header: 'Present', key: 'present' },
            { header: 'Late', key: 'late' },
            { header: 'Half-Day', key: 'halfDay' },
            { header: 'Absent', key: 'absent' },
            { header: 'On Leave', key: 'onLeave' },
            { header: 'WFH', key: 'wfh' },
            { header: 'Avg Check-In', key: 'avgCheckIn' },
            { header: 'Total Overtime Hours', key: 'totalOvertimeHours' },
          ],
          rows: result.dailySummary,
        },
        {
          name: 'Individual Register',
          columns: [
            { header: 'Employee Name', key: 'employeeName' },
            { header: 'Email', key: 'email' },
            { header: 'Department', key: 'department' },
            { header: 'Shift', key: 'shift' },
            { header: 'Working Days', key: 'workingDays' },
            { header: 'Present', key: 'present' },
            { header: 'Late', key: 'late' },
            { header: 'Absent', key: 'absent' },
            { header: 'Half-Day', key: 'halfDay' },
            { header: 'On Leave Days', key: 'onLeaveDays' },
            { header: 'WFH Days', key: 'wfhDays' },
            { header: 'Total Overtime Hours', key: 'totalOvertimeHours' },
            { header: 'Attendance %', key: 'attendancePct' },
            { header: 'Regularization Requests', key: 'regularizationRequests' },
          ],
          rows: result.individual,
        },
        {
          name: 'Latecomer Analysis',
          columns: [
            { header: 'Employee Name', key: 'employeeName' },
            { header: 'Department', key: 'department' },
            { header: 'Total Late Days', key: 'totalLateDays' },
            { header: 'Average Late By (min)', key: 'avgLateByMinutes' },
            { header: 'Max Consecutive Late Days', key: 'maxConsecutiveLateDays' },
            { header: 'Regularization Count', key: 'regularizationCount' },
          ],
          rows: result.latecomers,
        },
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.xlsx"');
      return res.send(buffer);
    }

    return res.json(result);
  }

  // ─── Monthly Efforts Logged Report (hours per project, paginated + Excel export) ────

  @Get('monthly-efforts')
  @Permissions(Permission.REPORT_MONTHLY_EFFORTS_VIEW)
  @ApiOperation({ summary: 'Get total hours logged per project, cumulative up to an as-of date (defaults to end of current month), paginated by project' })
  getMonthlyEffortsReport(@Query() query: MonthlyEffortsQueryDto) {
    return this.reportsService.getMonthlyEffortsReport(query);
  }

  @Get('export/monthly-efforts')
  @Permissions(Permission.REPORT_MONTHLY_EFFORTS_VIEW)
  @ApiOperation({ summary: 'Export the monthly efforts logged report as an Excel file' })
  async exportMonthlyEfforts(@Query() query: MonthlyEffortsQueryDto, @Res() res: any) {
    const rows = await this.reportsService.getMonthlyEffortsReportAll(query);
    const cols = [
      { header: 'Project', key: 'projectName' },
      { header: 'Total Hours', key: 'totalHours' },
      { header: 'Total Minutes', key: 'totalMinutes' },
    ];
    const buffer = await this.exportService.toExcel('Monthly Efforts Logged', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly-efforts-logged.xlsx"');
    return res.send(buffer);
  }

  // ─── Monthly Attendance Report (daily register, paginated + Excel export) ──

  @Get('monthly-attendance')
  @Permissions(Permission.REPORT_MONTHLY_ATTENDANCE_VIEW)
  @ApiOperation({
    summary:
      'Get a page of the monthly attendance register — one row per employee per calendar day of ' +
      'the selected month (defaults to the current month), showing check-in time or blank if ' +
      'absent/no record. Department, employee name, and active/inactive filters are optional.',
  })
  getMonthlyAttendanceReport(@Query() query: MonthlyAttendanceQueryDto) {
    return this.reportsService.getMonthlyAttendanceReport(query);
  }

  @Get('export/monthly-attendance')
  @Permissions(Permission.REPORT_MONTHLY_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Export the monthly attendance register (filtered or unfiltered) as an Excel file' })
  async exportMonthlyAttendance(@Query() query: MonthlyAttendanceQueryDto, @Res() res: any) {
    const rows = await this.reportsService.getMonthlyAttendanceReportAll(query);
    const cols = [
      { header: 'Employee Name', key: 'employeeName' },
      { header: 'Username', key: 'username' },
      { header: 'Status', key: 'userStatus' },
      { header: 'Date', key: 'date' },
      { header: 'Day', key: 'dayOfWeek' },
      { header: 'Check-In Time', key: 'checkInTime' },
    ];
    const buffer = await this.exportService.toExcel('Monthly Attendance Report', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly-attendance-report.xlsx"');
    return res.send(buffer);
  }

  // ─── Attendance Compliance Report (no check-in / no leave / no timesheet) ───

  @Get('non-compliance')
  @Permissions(Permission.REPORT_NON_COMPLIANCE_VIEW)
  @ApiOperation({
    summary:
      'Get a page of employees who, on a working day, have no check-in (and no approved ' +
      'regularization), no full-day leave and no timesheet entry. Defaults to today for every ' +
      'active employee; a range of up to 93 days, department/employee filters and ' +
      'weekend/holiday toggles are optional.',
  })
  getNonComplianceReport(@Query() query: NonComplianceQueryDto) {
    return this.reportsService.getNonComplianceReport(query);
  }

  @Get('export/non-compliance')
  @Permissions(Permission.REPORT_NON_COMPLIANCE_VIEW)
  @ApiOperation({
    summary: 'Export the attendance compliance report (filtered or unfiltered) as an Excel file',
  })
  async exportNonCompliance(@Query() query: NonComplianceQueryDto, @Res() res: any) {
    const rows = await this.reportsService.getNonComplianceReportAll(query);
    const cols = [
      { header: 'Employee Code', key: 'employeeCode' },
      { header: 'Employee Name', key: 'employeeName' },
      { header: 'Email', key: 'email' },
      { header: 'Department', key: 'department' },
      { header: 'Reporting Manager', key: 'manager' },
      { header: 'Date', key: 'date' },
      { header: 'Day', key: 'dayOfWeek' },
      { header: 'Shift Start', key: 'shiftStartTime' },
    ];
    const buffer = await this.exportService.toExcel('Attendance Compliance', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // Date-stamped: unlike the other report exports this one is always a
    // specific window, so the filename should say which.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-compliance-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    return res.send(buffer);
  }
}
