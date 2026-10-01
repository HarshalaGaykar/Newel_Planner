import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FreelancerStatus } from '@prisma/client';

@Injectable()
export class FreelancerExpiryCron {
  private readonly logger = new Logger(FreelancerExpiryCron.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 8 * * *')
  async handleContractExpiryAlerts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Send threshold alerts at 30, 15, and 7 days before expiry
    const thresholds = [30, 15, 7];
    for (const days of thresholds) {
      const target = new Date(today);
      target.setDate(target.getDate() + days);
      const nextDay = new Date(target);
      nextDay.setDate(nextDay.getDate() + 1);

      const expiring = await this.prisma.freelancer.findMany({
        where: {
          status: FreelancerStatus.ACTIVE,
          isActive: true,
          contractEnd: { gte: target, lt: nextDay },
        },
      });

      for (const f of expiring) {
        this.logger.warn(
          `[ContractExpiry] ${f.freelancerCode} – ${f.fullName} contract expires in ${days} days (${f.contractEnd.toDateString()})`,
        );
        // TODO (Prompt 7): await notificationsService.createForRole({ roles: ['ADMIN','PMO'], ... })
        // TODO (Prompt 7): await emailService.send({ subject: `Contract expiring: ${f.fullName}`, ... })
      }
    }

    // Auto-expire contracts that have passed today
    const expired = await this.prisma.freelancer.updateMany({
      where: {
        isActive: true,
        status: FreelancerStatus.ACTIVE,
        contractEnd: { lt: today },
      },
      data: { status: FreelancerStatus.CONTRACT_EXPIRED, isActive: false },
    });

    if (expired.count > 0) {
      this.logger.log(`Auto-expired ${expired.count} freelancer contract(s)`);
    }
  }
}
