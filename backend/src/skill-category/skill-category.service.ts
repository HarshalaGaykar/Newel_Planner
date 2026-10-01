import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSkillCategoryDto,
  UpdateSkillCategoryDto,
} from './dto/create-update.dto';

@Injectable()
export class SkillCategoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    const where = includeInactive ? undefined : { isActive: true };

    const [
      categories,
      totalCategories,
      activeCategories,
      inactiveCategories,
      totalSkills,
      categorizedSkills,
    ] = await this.prisma.$transaction([
      this.prisma.skillCategory.findMany({
        where,
        include: { _count: { select: { skills: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.skillCategory.count(),
      this.prisma.skillCategory.count({ where: { isActive: true } }),
      this.prisma.skillCategory.count({ where: { isActive: false } }),
      this.prisma.skill.count(),
      this.prisma.skill.count({ where: { categoryId: { not: null } } }),
    ]);

    return {
      data: categories.map(({ _count, ...category }) => ({
        ...category,
        skillCount: _count.skills,
      })),
      meta: {
        totalCategories,
        activeCategories,
        inactiveCategories,
        returnedCategories: categories.length,
        totalSkills,
        categorizedSkills,
        uncategorizedSkills: totalSkills - categorizedSkills,
      },
    };
  }

  async findById(id: string) {
    const category = await this.prisma.skillCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { skills: true } },
        skills: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Skill category "${id}" not found`);
    }

    return this.formatCategoryDetails(category);
  }

  async findByName(name: string) {
    const category = await this.prisma.skillCategory.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
      include: {
        _count: { select: { skills: true } },
        skills: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Skill category "${name}" not found`);
    }

    return this.formatCategoryDetails(category);
  }

  async create(dto: CreateSkillCategoryDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.skillCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(`Skill category "${name}" already exists`);
    }

    return this.prisma.skillCategory.create({
      data: {
        name,
        description: dto.description?.trim() || undefined,
      },
    });
  }

  async update(id: string, dto: UpdateSkillCategoryDto) {
    const category = await this.findById(id);
    const name = dto.name?.trim();
    const hasDescription = dto.description !== undefined;
    const hasIsActive = dto.isActive !== undefined;

    if (!name && !hasDescription && !hasIsActive) {
      throw new BadRequestException('No update fields provided');
    }

    if (name && name.toLowerCase() !== category.name.toLowerCase()) {
      const existing = await this.prisma.skillCategory.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });

      if (existing) {
        throw new ConflictException(`Skill category "${name}" already exists`);
      }
    }

    return this.prisma.skillCategory.update({
      where: { id },
      data: {
        name,
        description:
          hasDescription ? dto.description?.trim() || null : undefined,
        isActive: hasIsActive ? dto.isActive : undefined,
      },
    });
  }

  async softDelete(id: string) {
    await this.findById(id);

    return this.prisma.skillCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async hardDelete(id: string) {
    await this.findById(id);

    return this.prisma.skillCategory.delete({
      where: { id },
    });
  }

  private formatCategoryDetails(category: any) {
    const { _count, skills, ...rest } = category;

    return {
      ...rest,
      skillCount: _count.skills,
      skills,
      meta: {
        skillCount: _count.skills,
        hasSkills: _count.skills > 0,
      },
    };
  }
}
