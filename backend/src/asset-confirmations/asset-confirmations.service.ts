import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getZonedDateParts, resolveTimeZone } from '../attendance/time-zone.util';

export interface TeamAsset {
  id: string;
  assetTag: string;
  name: string;
  type: string;
  usedByName: string;
}

export interface RaWithAssets {
  ra: { id: string; firstName: string | null; lastName: string | null; email: string };
  assets: TeamAsset[];
}

const fullName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '' : '';

@Injectable()
export class AssetConfirmationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current period as "YYYY-MM" in the given time zone. */
  periodFor(timeZone?: string, date: Date = new Date()): string {
    const tz = resolveTimeZone(timeZone);
    const p = getZonedDateParts(date, tz);
    return `${p.year}-${String(p.month).padStart(2, '0')}`;
  }

  monthLabel(period: string): string {
    const [y, m] = period.split('-').map(Number);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[(m || 1) - 1]} ${y}`;
  }

  /** Assets whose current holder reports to the given RA. */
  async getTeamAssetsForRA(raId: string): Promise<TeamAsset[]> {
    const assets = await this.prisma.asset.findMany({
      where: { currentlyUsedById: { not: null }, currentlyUsedBy: { reportingAuthorityId: raId } },
      select: {
        id: true,
        assetTag: true,
        name: true,
        type: true,
        currentlyUsedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { assetTag: 'asc' },
    });
    return assets.map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      type: a.type,
      usedByName: fullName(a.currentlyUsedBy),
    }));
  }

  /** Group all in-use assets by the reporting authority of their current holder. */
  async getRAsWithTeamAssets(): Promise<RaWithAssets[]> {
    const assets = await this.prisma.asset.findMany({
      where: {
        currentlyUsedById: { not: null },
        currentlyUsedBy: { reportingAuthorityId: { not: null } },
      },
      select: {
        id: true,
        assetTag: true,
        name: true,
        type: true,
        currentlyUsedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            reportingAuthority: {
              select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
            },
          },
        },
      },
      orderBy: { assetTag: 'asc' },
    });

    const map = new Map<string, RaWithAssets>();
    for (const a of assets) {
      const ra = a.currentlyUsedBy?.reportingAuthority;
      if (!ra || !ra.isActive || !ra.email) continue; // can't chase an inactive/email-less manager
      if (!map.has(ra.id)) {
        map.set(ra.id, {
          ra: { id: ra.id, firstName: ra.firstName, lastName: ra.lastName, email: ra.email },
          assets: [],
        });
      }
      map.get(ra.id)!.assets.push({
        id: a.id,
        assetTag: a.assetTag,
        name: a.name,
        type: a.type,
        usedByName: fullName(a.currentlyUsedBy),
      });
    }
    return [...map.values()];
  }

  /** The logged-in manager's current-period status + their team's assets (for the confirm page). */
  async getCurrentForUser(userId: string, timeZone?: string) {
    const period = this.periodFor(timeZone);
    const [assets, confirmation] = await Promise.all([
      this.getTeamAssetsForRA(userId),
      this.prisma.assetAllocationConfirmation.findUnique({
        where: { reportingAuthorityId_period: { reportingAuthorityId: userId, period } },
      }),
    ]);
    return {
      period,
      monthLabel: this.monthLabel(period),
      status: confirmation?.status ?? 'PENDING',
      confirmedAt: confirmation?.confirmedAt ?? null,
      assetCount: assets.length,
      assets,
    };
  }

  /** Mark the current period confirmed for the logged-in manager. */
  async confirmCurrent(userId: string, timeZone?: string) {
    const period = this.periodFor(timeZone);
    const assets = await this.getTeamAssetsForRA(userId);
    return this.prisma.assetAllocationConfirmation.upsert({
      where: { reportingAuthorityId_period: { reportingAuthorityId: userId, period } },
      update: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedById: userId,
        assetCount: assets.length,
      },
      create: {
        reportingAuthorityId: userId,
        period,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedById: userId,
        assetCount: assets.length,
      },
    });
  }
}
