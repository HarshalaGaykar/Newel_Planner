import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppFeatureDto } from './dto/create-app-feature.dto';

@Injectable()
export class WhatsNewService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // USER FACING APIS (Feature Discovery)
  // ==========================================================================

  /**
   * Calculates the red dot notification count.
   * Finds all active, published features targeted to the user's role
   * that the user has NEVER interacted with.
   */
  async getUnreadCount(userId: string, roleName: string) {
    const count = await this.prisma.appFeature.count({
      where: {
        isActive: true,
        publishedAt: { lte: new Date() },
        roles: {
          some: { roleName }, // RBAC: Must be targeted to this role
        },
        interactions: {
          none: { userId },   // Unread: Must have NO interaction from this user
        },
      },
    });
    return { unreadCount: count };
  }

  /**
   * Gets the list of features for the Grid/Card view.
   * Returns all active features targeted to the user's role.
   * Appends an 'isNew' flag to help the UI highlight unread cards.
   */
  async getFeaturesForUser(userId: string, roleName: string) {
    const features = await this.prisma.appFeature.findMany({
      where: {
        isActive: true,
        publishedAt: { lte: new Date() },
        roles: {
          some: { roleName },
        },
      },
      include: {
        interactions: {
          where: { userId }, // Fetch only this user's interactions
          select: { id: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return features.map((f) => {
      // If the interactions array is empty, the user hasn't seen it yet.
      const isNew = f.interactions.length === 0;
      // Strip out the interactions array before sending to the client
      const { interactions, ...featureData } = f;
      return { ...featureData, isNew };
    });
  }

  /**
   * Marks a specific feature as seen by inserting an interaction record.
   * This clears it from the "unread" count.
   */
  async markAsSeen(userId: string, featureId: string) {
    return this.prisma.appFeatureInteraction.upsert({
      where: {
        featureId_userId: { featureId, userId },
      },
      update: {}, // Do nothing if it already exists
      create: {
        featureId,
        userId,
      },
    });
  }

  /**
   * Marks ALL features as seen for a user (bulk clear the red dot).
   * Usually called when the user opens the "What's New" grid page.
   */
  async markAllAsSeen(userId: string, roleName: string) {
    // 1. Find all active features for their role that they haven't seen
    const unseenFeatures = await this.prisma.appFeature.findMany({
      where: {
        isActive: true,
        publishedAt: { lte: new Date() },
        roles: { some: { roleName } },
        interactions: { none: { userId } },
      },
      select: { id: true },
    });

    if (unseenFeatures.length === 0) return { markedCount: 0 };

    // 2. Insert interaction rows in bulk
    const data = unseenFeatures.map((f) => ({
      featureId: f.id,
      userId,
    }));

    await this.prisma.appFeatureInteraction.createMany({
      data,
      skipDuplicates: true,
    });

    return { markedCount: data.length };
  }

  // ==========================================================================
  // ADMIN APIS (Feature Management)
  // ==========================================================================

  async createFeature(dto: CreateAppFeatureDto) {
    const { roles, ...featureData } = dto;
    return this.prisma.appFeature.create({
      data: {
        ...featureData,
        roles: {
          create: roles.map((r) => ({ roleName: r })),
        },
      },
      include: { roles: true },
    });
  }

  async getAllFeatures() {
    return this.prisma.appFeature.findMany({
      orderBy: { createdAt: 'desc' },
      include: { roles: true },
    });
  }
}
