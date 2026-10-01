import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AttendanceRegularizationService } from './attendance-regularization.service';
import {
  CreateRegularizationDto, RegularizationDecisionDto, RegularizationFilterDto,
} from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Attendance Regularization')
@ApiBearerAuth()
@Controller({ path: 'attendance/regularize', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttendanceRegularizationController {
  constructor(private readonly regularizationService: AttendanceRegularizationService) {}

  @Post()
  @Permissions(Permission.ATTENDANCE_REGULARIZE, Permission.ATTENDANCE_MARK)
  @ApiOperation({ summary: 'Create a new attendance regularization request' })
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateRegularizationDto,
  ) {
    return this.regularizationService.create(dto, userId);
  }

  @Get()
  @Permissions(Permission.ATTENDANCE_REGULARIZE, Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: "Get the current user's regularization requests with optional filters" })
  findMyRequests(
    @CurrentUser('userId') userId: string,
    @Query() filter: RegularizationFilterDto,
  ) {
    return this.regularizationService.findMyRequests(userId, filter);
  }

  @Get('pending')
  @Permissions(Permission.ATTENDANCE_REGULARIZE_APPROVE)
  @ApiOperation({ summary: 'Get pending regularization requests awaiting approval' })
  findPending(
    @CurrentUser('userId') approverId: string,
    @Query() filter: RegularizationFilterDto,
  ) {
    return this.regularizationService.findPending(approverId, filter);
  }

  @Patch(':id/approve')
  @Permissions(Permission.ATTENDANCE_REGULARIZE_APPROVE)
  @ApiOperation({ summary: 'Approve a regularization request by ID' })
  approve(
    @Param('id') id: string,
    @CurrentUser('userId') approverId: string,
    // Body is optional so existing callers that send nothing keep working.
    @Body() dto?: RegularizationDecisionDto,
  ) {
    return this.regularizationService.approve(id, approverId, dto?.remarks);
  }

  @Patch(':id/reject')
  @Permissions(Permission.ATTENDANCE_REGULARIZE_APPROVE)
  @ApiOperation({ summary: 'Reject a regularization request by ID' })
  reject(
    @Param('id') id: string,
    @CurrentUser('userId') approverId: string,
    @Body() dto?: RegularizationDecisionDto,
  ) {
    return this.regularizationService.reject(id, approverId, dto?.remarks);
  }
}
