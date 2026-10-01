import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Injectable()
export class CurrencyService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  async findOne(id: string) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException(`Currency "${id}" not found`);
    return currency;
  }

  async create(dto: CreateCurrencyDto) {
    const existing = await this.prisma.currency.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Currency "${dto.code}" already exists`);

    if (dto.isBase) {
      const base = await this.prisma.currency.findFirst({ where: { isBase: true } });
      if (base) throw new ConflictException(`Base currency "${base.code}" already exists`);
    }

    return this.prisma.currency.create({ data: dto });
  }

  async update(id: string, dto: UpdateCurrencyDto) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException(`Currency "${id}" not found`);

    if (dto.code && dto.code !== currency.code) {
      const taken = await this.prisma.currency.findUnique({ where: { code: dto.code } });
      if (taken) throw new ConflictException(`Currency "${dto.code}" already exists`);
    }

    if (dto.isBase && !currency.isBase) {
      const base = await this.prisma.currency.findFirst({ where: { isBase: true } });
      if (base) throw new ConflictException(`Base currency "${base.code}" already exists`);
    }

    return this.prisma.currency.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException(`Currency "${id}" not found`);

    const inUse = await this.prisma.company.count({ where: { currencyId: id } });
    if (inUse > 0) {
      throw new BadRequestException(`Currency is in use by ${inUse} company(ies) and cannot be deleted`);
    }

    return this.prisma.currency.delete({ where: { id } });
  }
}
