import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({
      include: { currency: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { currency: true, businessUnits: true, locations: true },
    });
    if (!company) throw new NotFoundException(`Company "${id}" not found`);
    return company;
  }

  async create(dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Company "${dto.name}" already exists`);
    return this.prisma.company.create({ data: dto, include: { currency: true } });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException(`Company "${id}" not found`);

    if (dto.name && dto.name !== company.name) {
      const taken = await this.prisma.company.findUnique({ where: { name: dto.name } });
      if (taken) throw new ConflictException(`Company "${dto.name}" already exists`);
    }

    return this.prisma.company.update({ where: { id }, data: dto, include: { currency: true } });
  }

  async remove(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException(`Company "${id}" not found`);

    const count = await this.prisma.company.count();
    if (count <= 1) throw new BadRequestException('At least one company must exist');

    return this.prisma.company.delete({ where: { id } });
  }
}
