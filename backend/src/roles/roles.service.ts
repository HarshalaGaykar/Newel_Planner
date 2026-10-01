import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException(`Role "${id}" not found`);
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        ...(dto.permissionIds?.length
          ? {
              permissions: {
                create: dto.permissionIds.map((permissionId) => ({ permissionId })),
              },
            }
          : {}),
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);

    if (dto.name) {
      const conflict = await this.prisma.role.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Role "${dto.name}" already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (dto.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          });
        }
      }
      return tx.role.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException(`Role "${id}" not found`);
    if (role._count.users > 0) {
      throw new ConflictException(`Cannot delete role with ${role._count.users} assigned user(s)`);
    }
    return this.prisma.role.delete({ where: { id } });
  }
}
