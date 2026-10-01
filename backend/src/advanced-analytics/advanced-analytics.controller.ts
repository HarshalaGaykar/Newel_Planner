import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Advanced Analytics')
@ApiBearerAuth()
@Controller('advanced-analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdvancedAnalyticsController {
  constructor(private readonly analyticsService: AdvancedAnalyticsService) {}

  @Get('burnout-risk')
  @Permissions(Permission.ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Get burnout risk analysis across team members' })
  async getBurnoutRisk() {
    return this.analyticsService.getBurnoutRisk();
  }

  @Get('anomalies')
  @Permissions(Permission.ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Detect anomalies in analytics data' })
  async getAnomalies() {
    return this.analyticsService.getAnomalies();
  }


  @Get('project-health/:projectId')
  @Permissions(Permission.ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Get the health score for a specific project by ID' })
  async getProjectHealthScore(@Param('projectId') projectId: string) {
    return this.analyticsService.getProjectHealthScore(projectId);
  }
}

