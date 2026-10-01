import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.skill.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!skill) throw new NotFoundException(`Skill "${id}" not found`);
    return skill;
  }

  async create(dto: CreateSkillDto) {
    const existing = await this.prisma.skill.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Skill "${dto.name}" already exists`);
    return this.prisma.skill.create({ data: dto });
  }

  async update(id: string, dto: UpdateSkillDto) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException(`Skill "${id}" not found`);

    if (dto.name && dto.name !== skill.name) {
      const taken = await this.prisma.skill.findUnique({ where: { name: dto.name } });
      if (taken) throw new ConflictException(`Skill "${dto.name}" already exists`);
    }

    return this.prisma.skill.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException(`Skill "${id}" not found`);
    return this.prisma.skill.delete({ where: { id } });
  }
}
