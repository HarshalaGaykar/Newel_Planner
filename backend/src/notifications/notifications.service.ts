import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { NotificationType, Notification } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async send(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: any,
    sendEmail: boolean = true,
    // Pre-rendered email to use instead of the plain-text fallback below. Passed
    // in (rather than sent by the caller) so the email preference check stays
    // here and callers cannot bypass it.
    emailContent?: { subject: string; html: string },
  ) {
    try {
      // 1. Check Preferences
      const dbPref = await this.prisma.notificationPreference.findUnique({
        where: { userId_type: { userId, type } },
      });

      // Default if not found
      const pref = dbPref || { inApp: true, email: true };

      let notification: Notification | null = null;

      // 2. Create In-App Notification
      if (pref.inApp) {
        notification = await this.prisma.notification.create({
          data: {
            userId,
            type,
            title,
            body,
            metadata: metadata || {},
          },
        });
      }

      // 3. Send Email
      if (pref.email && sendEmail) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user && user.email) {
          // Note: Specific service calls like sendTimesheetReminder would be called from the scheduler
          // This generic send just sends the basic body as HTML for now
          if (emailContent) {
            await this.emailService.send(user.email, emailContent.subject, emailContent.html);
          } else {
            await this.emailService.send(user.email, title, body.replace(/\n/g, '<br>'));
          }
        }
      }

      return notification;
    } catch (error) {
      this.logger.error(`Error sending notification to ${userId}:`, error);
      throw error;
    }
  }

  async sendToRole(
    roleName: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: any,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        role: { name: roleName },
        isActive: true,
      },
    });

    const results = await Promise.all(
      users.map(u => this.send(u.id, type, title, body, metadata)),
    );

    return results;
  }

  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnread(userId: string, limit: number = 20) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
    });
  }

  async updatePreference(userId: string, type: NotificationType, inApp: boolean, email: boolean) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, inApp, email },
      update: { inApp, email },
    });
  }

  async getAll(userId: string, limit: number = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
