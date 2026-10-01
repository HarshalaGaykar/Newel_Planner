import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriorityMasterDto } from './dto/create-priority-master.dto';
import { UpdatePriorityMasterDto } from './dto/update-priority-master.dto';

@Injectable()
export class PriorityMasterService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.priorityMaster.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async findOne(id: string) {
    const pm = await this.prisma.priorityMaster.findUnique({ where: { id } });
    if (!pm) throw new NotFoundException(`Priority "${id}" not found`);
    return pm;
  }

  async create(dto: CreatePriorityMasterDto) {
    const existing = await this.prisma.priorityMaster.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Priority "${dto.name}" already exists`);
    return this.prisma.priorityMaster.create({ data: dto });
  }

  async update(id: string, dto: UpdatePriorityMasterDto) {
    const pm = await this.prisma.priorityMaster.findUnique({ where: { id } });
    if (!pm) throw new NotFoundException(`Priority "${id}" not found`);

    if (dto.name && dto.name !== pm.name) {
      const taken = await this.prisma.priorityMaster.findUnique({ where: { name: dto.name } });
      if (taken) throw new ConflictException(`Priority "${dto.name}" already exists`);
    }

    return this.prisma.priorityMaster.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const pm = await this.prisma.priorityMaster.findUnique({ where: { id } });
    if (!pm) throw new NotFoundException(`Priority "${id}" not found`);
    return this.prisma.priorityMaster.delete({ where: { id } });
  }
}
