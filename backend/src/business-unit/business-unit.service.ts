import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';

@Injectable()
export class BusinessUnitService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.businessUnit.findMany({
      include: { company: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id },
      include: { company: true, departments: true },
    });
    if (!bu) throw new NotFoundException(`Business unit "${id}" not found`);
    return bu;
  }

  async create(dto: CreateBusinessUnitDto) {
    const existing = await this.prisma.businessUnit.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Business unit code "${dto.code}" already exists`);

    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException(`Company "${dto.companyId}" not found`);

    return this.prisma.businessUnit.create({ data: dto, include: { company: true } });
  }

  async update(id: string, dto: UpdateBusinessUnitDto) {
    const bu = await this.prisma.businessUnit.findUnique({ where: { id } });
    if (!bu) throw new NotFoundException(`Business unit "${id}" not found`);

    if (dto.code && dto.code !== bu.code) {
      const taken = await this.prisma.businessUnit.findUnique({ where: { code: dto.code } });
      if (taken) throw new ConflictException(`Business unit code "${dto.code}" already exists`);
    }

    return this.prisma.businessUnit.update({ where: { id }, data: dto, include: { company: true } });
  }

  async remove(id: string) {
    const bu = await this.prisma.businessUnit.findUnique({ where: { id } });
    if (!bu) throw new NotFoundException(`Business unit "${id}" not found`);
    return this.prisma.businessUnit.delete({ where: { id } });
  }
}
