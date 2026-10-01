import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveTypeMasterDto } from './dto/create-leave-type-master.dto';
import { UpdateLeaveTypeMasterDto } from './dto/update-leave-type-master.dto';

@Injectable()
export class LeaveTypeMasterService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.leaveTypeMaster.findMany({ orderBy: { code: 'asc' } });
  }

  async findOne(id: string) {
    const lt = await this.prisma.leaveTypeMaster.findUnique({ where: { id } });
    if (!lt) throw new NotFoundException(`Leave type "${id}" not found`);
    return lt;
  }

  async create(dto: CreateLeaveTypeMasterDto) {
    const existing = await this.prisma.leaveTypeMaster.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Leave type code "${dto.code}" already exists`);
    return this.prisma.leaveTypeMaster.create({ data: dto });
  }

  async update(id: string, dto: UpdateLeaveTypeMasterDto) {
    const lt = await this.prisma.leaveTypeMaster.findUnique({ where: { id } });
    if (!lt) throw new NotFoundException(`Leave type "${id}" not found`);

    if (dto.code && dto.code !== lt.code) {
      const taken = await this.prisma.leaveTypeMaster.findUnique({ where: { code: dto.code } });
      if (taken) throw new ConflictException(`Leave type code "${dto.code}" already exists`);
    }

    return this.prisma.leaveTypeMaster.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const lt = await this.prisma.leaveTypeMaster.findUnique({ where: { id } });
    if (!lt) throw new NotFoundException(`Leave type "${id}" not found`);

    const inUse = await this.prisma.leave.count({ where: { leaveTypeCode: lt.code } });
    if (inUse > 0) {
      throw new BadRequestException(`Leave type "${lt.code}" is referenced by ${inUse} leave record(s) and cannot be deleted`);
    }

    return this.prisma.leaveTypeMaster.delete({ where: { id } });
  }
}
