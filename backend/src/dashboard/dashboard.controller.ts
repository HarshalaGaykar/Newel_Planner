import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('portfolio-kpis')
  @ApiOperation({ summary: 'Get portfolio-wide KPI metrics across all projects' })
  getPortfolioKpis() {
    return this.dashboardService.getPortfolioKpis();
  }

  @Get('project/:id/rag')
  @ApiOperation({ summary: 'Get the RAG health status for a project by ID' })
  getProjectHealthRag(@Param('id') id: string) {
    return this.dashboardService.getProjectHealthRag(id);
  }

  @Get('pm')
  @ApiOperation({ summary: 'Get the project manager dashboard for the current user' })
  getPmDashboard(@CurrentUser('userId') userId: string) {
    return this.dashboardService.getPmDashboard(userId);
  }

  @Get('hr')
  @ApiOperation({ summary: 'Get the HR dashboard metrics' })
  getHrDashboard() {
    return this.dashboardService.getHrDashboard();
  }

  @Get('finance')
  @ApiOperation({ summary: 'Get the finance dashboard metrics' })
  getFinanceDashboard() {
    return this.dashboardService.getFinanceDashboard();
  }

  @Get('user')
  @ApiOperation({ summary: 'Get the personal dashboard for the current user with optional time zone' })
  getUserDashboard(
    @CurrentUser('userId') userId: string,
    @Query('timeZone') timeZone?: string,
  ) {
    return this.dashboardService.getUserDashboard(userId, timeZone);
  }

  // Legacy endpoints
  @Get('tl/:id')
  @ApiOperation({ summary: 'Get the team lead dashboard by user ID' })
  getTLDashboard(@Param('id') id: string) {
    return this.dashboardService.getTLDashboard(id);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get KPI metrics for a specific project by ID' })
  getProjectKpis(@Param('projectId') projectId: string) {
    return this.dashboardService.getProjectKpis(projectId);
  }

  @Get('project/:projectId/insights')
  @ApiOperation({ summary: 'Get project insights filtered by optional date range and milestone' })
  getProjectInsights(
    @Param('projectId') projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('milestoneId') milestoneId?: string,
  ) {
    return this.dashboardService.getProjectInsights(
      projectId,
      startDate,
      endDate,
      milestoneId,
    );
  }
}
