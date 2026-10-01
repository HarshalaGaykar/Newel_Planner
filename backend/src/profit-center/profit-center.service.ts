import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfitCenterDto } from './dto/create-profit-center.dto';
import { UpdateProfitCenterDto } from './dto/update-profit-center.dto';

@Injectable()
export class ProfitCenterService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.profitCenter.findMany({ orderBy: { code: 'asc' } });
  }

  async findOne(id: string) {
    const pc = await this.prisma.profitCenter.findUnique({ where: { id } });
    if (!pc) throw new NotFoundException(`Profit center "${id}" not found`);
    return pc;
  }

  async create(dto: CreateProfitCenterDto) {
    const existing = await this.prisma.profitCenter.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Profit center code "${dto.code}" already exists`);
    return this.prisma.profitCenter.create({ data: dto });
  }

  async update(id: string, dto: UpdateProfitCenterDto) {
    const pc = await this.prisma.profitCenter.findUnique({ where: { id } });
    if (!pc) throw new NotFoundException(`Profit center "${id}" not found`);

    if (dto.code && dto.code !== pc.code) {
      const taken = await this.prisma.profitCenter.findUnique({ where: { code: dto.code } });
      if (taken) throw new ConflictException(`Profit center code "${dto.code}" already exists`);
    }

    return this.prisma.profitCenter.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const pc = await this.prisma.profitCenter.findUnique({ where: { id } });
    if (!pc) throw new NotFoundException(`Profit center "${id}" not found`);
    return this.prisma.profitCenter.delete({ where: { id } });
  }
}
