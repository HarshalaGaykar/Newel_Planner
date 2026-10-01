import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@Injectable()
export class CostCenterService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.costCenter.findMany({
      include: { department: true },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const cc = await this.prisma.costCenter.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!cc) throw new NotFoundException(`Cost center "${id}" not found`);
    return cc;
  }

  async create(dto: CreateCostCenterDto) {
    const existing = await this.prisma.costCenter.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Cost center code "${dto.code}" already exists`);
    return this.prisma.costCenter.create({ data: dto, include: { department: true } });
  }

  async update(id: string, dto: UpdateCostCenterDto) {
    const cc = await this.prisma.costCenter.findUnique({ where: { id } });
    if (!cc) throw new NotFoundException(`Cost center "${id}" not found`);

    if (dto.code && dto.code !== cc.code) {
      const taken = await this.prisma.costCenter.findUnique({ where: { code: dto.code } });
      if (taken) throw new ConflictException(`Cost center code "${dto.code}" already exists`);
    }

    return this.prisma.costCenter.update({ where: { id }, data: dto, include: { department: true } });
  }

  async remove(id: string) {
    const cc = await this.prisma.costCenter.findUnique({ where: { id } });
    if (!cc) throw new NotFoundException(`Cost center "${id}" not found`);
    return this.prisma.costCenter.delete({ where: { id } });
  }
}
