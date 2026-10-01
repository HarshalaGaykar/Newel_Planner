import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class ShiftService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.shift.findMany({
      include: { location: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { location: true },
    });
    if (!shift) throw new NotFoundException(`Shift "${id}" not found`);
    return shift;
  }

  private validateTimes(startTime: string, endTime: string) {
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  async create(dto: CreateShiftDto) {
    this.validateTimes(dto.startTime, dto.endTime);
    return this.prisma.shift.create({ data: dto, include: { location: true } });
  }

  async update(id: string, dto: UpdateShiftDto) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException(`Shift "${id}" not found`);

    const startTime = dto.startTime ?? shift.startTime;
    const endTime = dto.endTime ?? shift.endTime;
    this.validateTimes(startTime, endTime);

    return this.prisma.shift.update({ where: { id }, data: dto, include: { location: true } });
  }

  async remove(id: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException(`Shift "${id}" not found`);
    return this.prisma.shift.delete({ where: { id } });
  }
}
