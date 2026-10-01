import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertConfigDto } from './dto/admin-config.dto';

export type RescheduleCallback = (key: string) => Promise<void>;

@Injectable()
export class AdminConfigService {
  private rescheduleCallback?: RescheduleCallback;

  constructor(private prisma: PrismaService) {}

  setRescheduleCallback(cb: RescheduleCallback) {
    this.rescheduleCallback = cb;
  }

  async get(key: string): Promise<string> {
    const config = await this.prisma.adminConfig.findUnique({
      where: { key },
    });
    if (!config) throw new NotFoundException(`Config with key "${key}" not found`);
    return config.value;
  }

  async getNumber(key: string): Promise<number> {
    const value = await this.get(key);
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new BadRequestException(`Config value for "${key}" is not a valid number: ${value}`);
    }
    return num;
  }

  async set(key: string, dto: UpsertConfigDto, updatedById: string): Promise<void> {
    await this.prisma.adminConfig.upsert({
      where: { key },
      create: {
        key,
        value: dto.value,
        label: dto.label,
        group: dto.group,
        updatedById,
      },
      update: {
        value: dto.value,
        label: dto.label ?? undefined,
        group: dto.group ?? undefined,
        updatedById,
      },
    });
    // Live-reschedule the matching cron job if this key controls a scheduler schedule.
    await this.rescheduleCallback?.(key);
  }

  async getAllByGroup(): Promise<Record<string, any[]>> {
    const configs = await this.prisma.adminConfig.findMany({
      orderBy: { key: 'asc' },
    });

    return configs.reduce((acc, config) => {
      const group = config.group || 'OTHER';
      if (!acc[group]) acc[group] = [];
      acc[group].push(config);
      return acc;
    }, {} as Record<string, any[]>);
  }

  async getGroup(group: string): Promise<Record<string, string>> {
    const configs = await this.prisma.adminConfig.findMany({
      where: { group },
    });
    return configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {} as Record<string, string>);
  }
}
