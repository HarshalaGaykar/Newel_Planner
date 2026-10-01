import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { BulkUploadPublicHolidayDto } from './dto/bulk-upload-public-holiday.dto';

@Injectable()
export class PublicHolidaysService {
  constructor(private prisma: PrismaService) {}

  findAll(year?: number) {
    const where = year
      ? {
          date: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31`),
          },
        }
      : {};
    return this.prisma.publicHoliday.findMany({ where, orderBy: { date: 'asc' } });
  }

  async findOne(id: string) {
    const holiday = await this.prisma.publicHoliday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException(`Public holiday "${id}" not found`);
    return holiday;
  }

  async create(dto: CreatePublicHolidayDto) {
    const date = new Date(dto.date);
    const locationId = dto.locationId ?? null;
    const existing = await this.prisma.publicHoliday.findFirst({ where: { date, locationId } });
    if (existing) throw new ConflictException(`A holiday already exists on ${dto.date} for this location`);
    return this.prisma.publicHoliday.create({ data: { ...dto, date, locationId } });
  }

  async update(id: string, dto: UpdatePublicHolidayDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.date) {
      data.date = new Date(dto.date);
      const conflict = await this.prisma.publicHoliday.findFirst({
        where: { date: data.date, locationId: dto.locationId ?? null, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Another holiday exists on ${dto.date}`);
    }
    return this.prisma.publicHoliday.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.publicHoliday.delete({ where: { id } });
  }

  async bulkUpload(dto: BulkUploadPublicHolidayDto) {
    const results: { name: string; status: 'created' | 'skipped'; reason?: string }[] = [];

    for (const holidayDto of dto.holidays) {
      try {
        await this.create(holidayDto);
        results.push({ name: holidayDto.name, status: 'created' });
      } catch (err: any) {
        results.push({ name: holidayDto.name, status: 'skipped', reason: err.message });
      }
    }

    return { total: dto.holidays.length, results };
  }
}
