import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.location.findMany({
      include: { company: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { company: true, shifts: true },
    });
    if (!location) throw new NotFoundException(`Location "${id}" not found`);
    return location;
  }

  async create(dto: CreateLocationDto) {
    if (dto.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw new NotFoundException(`Company "${dto.companyId}" not found`);
    }
    return this.prisma.location.create({ data: dto, include: { company: true } });
  }

  async update(id: string, dto: UpdateLocationDto) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException(`Location "${id}" not found`);
    return this.prisma.location.update({ where: { id }, data: dto, include: { company: true } });
  }

  async remove(id: string) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException(`Location "${id}" not found`);
    return this.prisma.location.delete({ where: { id } });
  }
}
