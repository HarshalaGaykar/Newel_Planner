import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Res } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { CreateLeafDto } from './dto/create-leaf.dto';
import { LeaveDecisionDto } from './dto/leave-decision.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Leaves')
@ApiBearerAuth()
@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  @Permissions(Permission.WORKFORCE_LEAVE_APPLY)
  @ApiOperation({ summary: 'Apply for a new leave request' })
  create(@Body() createLeafDto: CreateLeafDto) {
    return this.leavesService.create(createLeafDto);
  }

  @Get()
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW)
  @ApiOperation({ summary: 'Get a list of leaves, optionally filtered by user' })
  findAll(@CurrentUser() actor: any, @Query('userId') userId?: string) {
    return this.leavesService.findAll(actor.userId, actor.role, userId);
  }

  @Get('balance')
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW)
  @ApiOperation({ summary: 'Get the leave balances for a given user' })
  getMyBalance(@Query('userId') userId: string) {
    return this.leavesService.getBalancesForUser(userId);
  }

  // Legacy per-user balance endpoint kept for backwards compatibility
  @Get('balances/:userId')
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW)
  @ApiOperation({ summary: 'Get the leave balances for a specific user by ID (legacy)' })
  getBalances(@Param('userId') userId: string) {
    return this.leavesService.getBalancesForUser(userId);
  }

  @Get('calendar')
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW)
  @ApiOperation({ summary: 'Get the leave calendar for a given month and year, optionally filtered by department' })
  getCalendar(
    @CurrentUser() actor: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.leavesService.getCalendar(actor.userId, actor.role, Number(month), Number(year), departmentId);
  }

  @Get('pending-approvals')
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW, Permission.WORKFORCE_LEAVE_APPROVE)
  @ApiOperation({ summary: 'Get leave requests pending the current user\'s approval' })
  getPendingApprovals(@CurrentUser() actor: any) {
    return this.leavesService.getPendingApprovals(actor.userId, actor.role);
  }

  @Get('export/my-leaves')
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW)
  @ApiOperation({ summary: 'Export the current user\'s leaves as an Excel file' })
  async exportMyLeaves(@CurrentUser() actor: any, @Res() res: any) {
    const buffer = await this.leavesService.exportLeaves(actor.userId, actor.role);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="my-leaves-export.xlsx"',
    });
    res.end(buffer);
  }

  @Get(':id')
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW)
  @ApiOperation({ summary: 'Get a single leave request by ID' })
  findOne(@Param('id') id: string) {
    return this.leavesService.findOne(id);
  }

  @Patch(':id/ra-approve')
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW, Permission.WORKFORCE_LEAVE_APPROVE)
  @ApiOperation({ summary: 'Approve a leave request as the reporting authority' })
  raApprove(
    @CurrentUser() actor: any,
    @Param('id') id: string,
    // Optional body so existing callers that send nothing keep working.
    @Body() dto?: LeaveDecisionDto,
  ) {
    return this.leavesService.raApprove(id, actor.userId, actor.role, dto?.remarks);
  }

@Patch(':id/reject')
  @Permissions(Permission.WORKFORCE_LEAVE_VIEW, Permission.WORKFORCE_LEAVE_APPROVE)
  @ApiOperation({ summary: 'Reject a leave request' })
  reject(
    @CurrentUser() actor: any,
    @Param('id') id: string,
    @Body() dto?: LeaveDecisionDto,
  ) {
    return this.leavesService.reject(id, actor.userId, actor.role, dto?.remarks);
  }

  @Delete(':id')
  @Permissions(Permission.WORKFORCE_LEAVE_APPLY) // Usually requester can delete their own pending leave
  @ApiOperation({ summary: 'Delete a leave request by ID' })
  remove(@Param('id') id: string) {
    return this.leavesService.remove(id);
  }

  // Leave balance management — accessible by ADMIN and HR
  @Get('admin/all-balances')
  @Permissions(Permission.WORKFORCE_LEAVE_APPROVE)
  @ApiOperation({ summary: 'Get leave balances for all users (admin)' })
  getAllBalances() {
    return this.leavesService.getAllBalances();
  }

  @Patch('admin/balance')
  @Permissions(Permission.WORKFORCE_LEAVE_APPROVE)
  @ApiOperation({ summary: 'Update a user\'s leave balance for a specific leave type (admin)' })
  updateBalance(@Body() body: { userId: string; leaveTypeCode: string; earnedBalance: number; carryForward?: number }) {
    return this.leavesService.updateBalance(body.userId, body.leaveTypeCode, body.earnedBalance, body.carryForward);
  }

  @Post('admin/bulk-update')
  @Permissions(Permission.WORKFORCE_LEAVE_APPROVE)
  @ApiOperation({ summary: 'Bulk update leave balances for multiple users (admin)' })
  bulkUpdateBalances(@Body() body: { updates: { email: string; leaveTypeCode: string; earnedBalance: number }[] }) {
    return this.leavesService.bulkUpdateBalances(body.updates);
  }

  @Post('admin/init-balances')
  @Permissions(Permission.WORKFORCE_LEAVE_APPROVE)
  @ApiOperation({ summary: 'Initialize leave balances with default values for one or all users (admin)' })
  initBalances(@Body() body: { defaults: Record<string, number>; userId?: string }) {
    return this.leavesService.initBalances(body.defaults, body.userId);
  }

  @Post('admin/check-expiry')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Trigger a check for expiring leave balances (admin)' })
  checkExpiry() {
    return this.leavesService.checkExpiry();
  }

  @Post('admin/carry-forward')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Run the leave balance carry-forward process (admin)' })
  runCarryForward() {
    return this.leavesService.runCarryForward();
  }
}

