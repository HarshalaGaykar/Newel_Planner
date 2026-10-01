import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TlDashboardService } from './tl-dashboard.service';
import { TlStatsQueryDto } from './dto/tl-stats-query.dto';
import { TlLeaveCalendarQueryDto } from './dto/tl-leave-calendar-query.dto';
import { TlGanttQueryDto } from './dto/tl-gantt-query.dto';

// Correctly-scoped (reportingAuthorityId, not departmentId) replacement for
// the legacy `GET /dashboard/tl/:id` — see dashboard.controller.ts, which is
// left untouched. Every endpoint here always acts on the calling TL's own
// id (@CurrentUser), never a route/query param, so a caller can't view
// another TL's dashboard by guessing an id.
@ApiTags('TL Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tl-dashboard')
export class TlDashboardController {
  constructor(private readonly tlDashboardService: TlDashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: "Get the TL's 4 stat cards (active projects, pending leaves/timesheets, team size) with period-over-period trend" })
  getStats(@CurrentUser('userId') tlId: string, @Query() query: TlStatsQueryDto) {
    return this.tlDashboardService.getStats(tlId, query);
  }

  @Get('tasks-by-status')
  @ApiOperation({ summary: "Get the TL's team and own tasks bucketed into Backlog/WIP/Done" })
  getTasksByStatus(@CurrentUser('userId') tlId: string) {
    return this.tlDashboardService.getTasksByStatus(tlId);
  }

  @Get('leave-calendar')
  @ApiOperation({ summary: "Get a day-by-day leave calendar for the TL's direct reports for a given month" })
  getLeaveCalendar(@CurrentUser('userId') tlId: string, @Query() query: TlLeaveCalendarQueryDto) {
    return this.tlDashboardService.getLeaveCalendar(tlId, query);
  }

  @Get('gantt')
  @ApiOperation({ summary: "Get a filtered, paginated Gantt task list for the TL, a specific direct report, or the whole team" })
  getGantt(@CurrentUser('userId') tlId: string, @Query() query: TlGanttQueryDto) {
    return this.tlDashboardService.getGantt(tlId, query);
  }
}
