import { Controller, Get, Patch, Put, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationType } from '@prisma/client';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('user-alerts')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of the current user notifications with an optional limit' })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getAll(userId, limit ? parseInt(limit) : 20);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Get the count and items of the current user unread notifications' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const unread = await this.notificationsService.getUnread(userId);
    return { count: unread.length, items: unread };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read by ID' })
  async markRead(
    @Param('id') id: string,
    
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markRead(id, userId);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all of the current user notifications as read' })
  async markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get the current user notification preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update the in-app and email preference for a notification type' })
  async updatePreference(
    @CurrentUser('id') userId: string,
    @Body() body: { type: NotificationType; inApp: boolean; email: boolean },
  ) {
    return this.notificationsService.updatePreference(
      userId,
      body.type,
      body.inApp,
      body.email,
    );
  }
}
