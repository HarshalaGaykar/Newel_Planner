import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WhatsNewService } from './whats-new.service';
import { CreateAppFeatureDto } from './dto/create-app-feature.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('WhatsNew')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('whats-new')
export class WhatsNewController {
  constructor(private readonly whatsNewService: WhatsNewService) {}

  // ==========================================================================
  // USER FACING APIS (Feature Discovery)
  // ==========================================================================

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread features for red dot notification' })
  getUnreadCount(@CurrentUser() user: any) {
    return this.whatsNewService.getUnreadCount(user.userId, user.role);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active features relevant to user role' })
  getFeatures(@CurrentUser() user: any) {
    return this.whatsNewService.getFeaturesForUser(user.userId, user.role);
  }

  @Post('mark-all-seen')
  @ApiOperation({ summary: 'Mark all features as seen (clears red dot)' })
  markAllSeen(@CurrentUser() user: any) {
    return this.whatsNewService.markAllAsSeen(user.userId, user.role);
  }

  @Post(':id/mark-seen')
  @ApiOperation({ summary: 'Mark a specific feature as seen' })
  markSeen(@Param('id') id: string, @CurrentUser() user: any) {
    return this.whatsNewService.markAsSeen(user.userId, id);
  }

  // ==========================================================================
  // ADMIN APIS (Feature Management)
  // ==========================================================================

  @Post('admin')
  @Roles(Role.ADMIN) // Only Admin can create features
  @ApiOperation({ summary: 'Admin: Create a new feature announcement' })
  createFeature(@Body() dto: CreateAppFeatureDto) {
    return this.whatsNewService.createFeature(dto);
  }

  @Get('admin')
  @Roles(Role.ADMIN) // Only Admin can view the master list
  @ApiOperation({ summary: 'Admin: Get all features (including drafts)' })
  getAllFeatures() {
    return this.whatsNewService.getAllFeatures();
  }
}
