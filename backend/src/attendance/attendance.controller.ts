import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceCheckinReminderCron } from './attendance-checkin-reminder.cron';
import { CheckInDto, CheckOutDto, AttendanceFilterDto, DailySummaryDto } from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions, Roles } from '../auth/decorators/rbac.decorator';
import { Permission, Role } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller({ path: 'attendance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly checkinReminderCron: AttendanceCheckinReminderCron,
  ) {}

  @Get('today')
  @Permissions(Permission.ATTENDANCE_READ, Permission.ATTENDANCE_MARK)
  @ApiOperation({ summary: "Get the current user's attendance status for today" })
  getTodayStatus(
    @CurrentUser('userId') userId: string,
    @Query('timeZone') timeZone?: string,
  ) {
    return this.attendanceService.getTodayStatus(userId, timeZone);
  }

  @Post('check-in')
  @Permissions(Permission.ATTENDANCE_MARK)
  @ApiOperation({ summary: 'Check in to mark the start of the workday' })
  checkIn(@CurrentUser('userId') userId: string, @Body() dto: CheckInDto) {
    return this.attendanceService.checkIn(userId, dto);
  }

  @Post('check-out')
  @Permissions(Permission.ATTENDANCE_MARK)
  @ApiOperation({ summary: 'Check out to mark the end of the workday' })
  checkOut(@CurrentUser('userId') userId: string, @Body() dto: CheckOutDto) {
    return this.attendanceService.checkOut(userId, dto);
  }

  @Get('summary')
  @Permissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Get the daily attendance summary for a given date' })
  getDailySummary(
    @CurrentUser('userId') userId: string,
    @Query() query: DailySummaryDto,
  ) {
    return this.attendanceService.getDailySummary(userId, query.date, query.timeZone);
  }

  @Get('my')
  @Permissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: "Get the current user's attendance records with optional filters" })
  findAll(@CurrentUser() actor: any, @Query() filter: AttendanceFilterDto) {
    return this.attendanceService.findAll(actor.userId, actor.role, filter);
  }

  @Get('team')
  @Permissions(Permission.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: "Get the team's attendance records with optional filters" })
  getTeamAttendance(@CurrentUser() actor: any, @Query() filter: AttendanceFilterDto) {
    return this.attendanceService.getTeamAttendance(actor.userId, actor.role, filter);
  }

  @Post('checkin-reminder/run')
  @Roles(Role.ADMIN)
  @Permissions(Permission.ATTENDANCE_MANAGE)
  @ApiOperation({
    summary:
      'Manually trigger the missing check-in reminder (ADMIN only). Optional ?date=YYYY-MM-DD evaluates that day instead of yesterday; bypasses the enabled toggle.',
  })
  runCheckinReminder(@Query('date') date?: string) {
    return this.checkinReminderCron.run(date, true);
  }
}
