import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NumberSeriesService {
  constructor(private prisma: PrismaService) {}

  async generateCode(module: string): Promise<string> {
    return await this.prisma.$transaction(async (tx) => {
      const series = await tx.numberSeries.findUnique({
        where: { module },
      });

      if (!series) {
        throw new NotFoundException(`Number series for module "${module}" not found`);
      }

      const nextSeq = series.lastSeq + 1;

      await tx.numberSeries.update({
        where: { module },
        data: { lastSeq: nextSeq },
      });

      const paddedSeq = nextSeq.toString().padStart(series.padding, '0');
      return `${series.prefix}${series.separator}${paddedSeq}`;
    });
  }

  async getAllSeries() {
    return this.prisma.numberSeries.findMany({
      orderBy: { module: 'asc' },
    });
  }

  async updateSeries(module: string, data: { prefix: string; padding: number; separator?: string }) {
    return this.prisma.numberSeries.update({
      where: { module },
      data: {
        prefix: data.prefix,
        padding: data.padding,
        separator: data.separator ?? undefined,
      },
    });
  }
}
