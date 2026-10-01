import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { ReorderMenuDto } from './dto/reorder-menu.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

export interface UserMenuNode {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  order: number;
  parentId: string | null;
  children: UserMenuNode[];
}

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin CRUD ─────────────────────────────────────────────────────────────

  async create(dto: CreateMenuDto) {
    const existing = await this.prisma.menu.findUnique({ where: { path: dto.path } });
    if (existing) {
      throw new ConflictException(`Menu with path "${dto.path}" already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.menu.findUnique({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException(`Parent menu "${dto.parentId}" not found`);
      }
    }

    const order = dto.order ?? (await this.getNextOrder(dto.parentId ?? null));

    return this.prisma.menu.create({
      data: {
        name: dto.name,
        path: dto.path,
        icon: dto.icon ?? null,
        order,
        isActive: dto.isActive ?? true,
        parentId: dto.parentId ?? null,
      },
      include: this.includeDetails(),
    });
  }

  async findAll() {
    const menus = await this.prisma.menu.findMany({
      orderBy: { order: 'asc' },
      include: this.includeDetails(),
    });
    return this.buildTree(menus);
  }

  async findAllFlat() {
    return this.prisma.menu.findMany({
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
      include: this.includeDetails(),
    });
  }

  async findOne(id: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: { orderBy: { order: 'asc' }, include: this.includeDetails() },
        permissions: { include: { permission: true } },
      },
    });
    if (!menu) throw new NotFoundException(`Menu "${id}" not found`);
    return menu;
  }

  async update(id: string, dto: UpdateMenuDto) {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) throw new NotFoundException(`Menu "${id}" not found`);

    if (dto.path && dto.path !== menu.path) {
      const pathTaken = await this.prisma.menu.findUnique({ where: { path: dto.path } });
      if (pathTaken) throw new ConflictException(`Menu with path "${dto.path}" already exists`);
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('A menu cannot be its own parent');
      }
      const allMenus = await this.prisma.menu.findMany({ select: { id: true, parentId: true } });
      if (this.wouldCreateCircular(id, dto.parentId, allMenus)) {
        throw new BadRequestException('Setting this parent would create a circular hierarchy');
      }
      const parent = await this.prisma.menu.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException(`Parent menu "${dto.parentId}" not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.path !== undefined) data.path = dto.path;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.parentId !== undefined) data.parentId = dto.parentId; // null clears parent

    return this.prisma.menu.update({
      where: { id },
      data,
      include: this.includeDetails(),
    });
  }

  async remove(id: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: { children: { select: { id: true } } },
    });
    if (!menu) throw new NotFoundException(`Menu "${id}" not found`);
    if (menu.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete a menu that has child items. Remove children first.',
      );
    }
    return this.prisma.menu.delete({ where: { id } });
  }

  async reorder(dto: ReorderMenuDto) {
    const updates = dto.items.map((item) =>
      this.prisma.menu.update({ where: { id: item.id }, data: { order: item.order } }),
    );
    await this.prisma.$transaction(updates);
    return { message: 'Menu order updated' };
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto) {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) throw new NotFoundException(`Menu "${id}" not found`);

    if (dto.permissionIds.length > 0) {
      const found = await this.prisma.permission.findMany({
        where: { id: { in: dto.permissionIds } },
      });
      if (found.length !== dto.permissionIds.length) {
        throw new BadRequestException('One or more permission IDs are invalid');
      }
    }

    await this.prisma.$transaction([
      this.prisma.menuPermission.deleteMany({ where: { menuId: id } }),
      ...dto.permissionIds.map((permissionId) =>
        this.prisma.menuPermission.create({ data: { menuId: id, permissionId } }),
      ),
    ]);

    return this.findOne(id);
  }

  // ─── Dynamic user menu ──────────────────────────────────────────────────────

  async getUserMenu(userPermissions: string[]): Promise<UserMenuNode[]> {
    const allMenus = await this.prisma.menu.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        permissions: {
          include: { permission: { select: { name: true } } },
        },
      },
    });

    // A node is directly accessible when it has no required permissions (public)
    // or the user holds at least one required permission (OR semantics)
    const isAccessible = (menu: any): boolean => {
      if (menu.permissions.length === 0) return true;
      return menu.permissions.some(({ permission }: any) =>
        userPermissions.includes(permission.name),
      );
    };

    const menuById = new Map(allMenus.map((m) => [m.id, m]));

    const visibleIds = new Set<string>(allMenus.filter(isAccessible).map((m) => m.id));

    // Walk upward: if a descendant is accessible its ancestors must also be shown
    for (const id of [...visibleIds]) {
      let parentId = menuById.get(id)?.parentId as string | null;
      while (parentId) {
        visibleIds.add(parentId);
        parentId = menuById.get(parentId)?.parentId ?? null;
      }
    }

    return this.buildUserTree(allMenus.filter((m) => visibleIds.has(m.id)));
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildUserTree(menus: any[]): UserMenuNode[] {
    const map = new Map<string, UserMenuNode>();
    for (const m of menus) {
      map.set(m.id, {
        id: m.id,
        name: m.name,
        path: m.path,
        icon: m.icon,
        order: m.order,
        parentId: m.parentId,
        children: [],
      });
    }

    const roots: UserMenuNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sort = (items: UserMenuNode[]) => {
      items.sort((a, b) => a.order - b.order);
      items.forEach((i) => sort(i.children));
    };
    sort(roots);
    return roots;
  }

  private includeDetails() {
    return {
      permissions: {
        include: { permission: { select: { id: true, name: true, description: true } } },
      },
    };
  }

  private async getNextOrder(parentId: string | null): Promise<number> {
    const last = await this.prisma.menu.findFirst({
      where: { parentId },
      orderBy: { order: 'desc' },
    });
    return (last?.order ?? -1) + 1;
  }

  // Returns true if making newParentId the parent of menuId would form a cycle
  private wouldCreateCircular(
    menuId: string,
    newParentId: string,
    allMenus: { id: string; parentId: string | null }[],
  ): boolean {
    const parentMap = new Map(allMenus.map((m) => [m.id, m.parentId]));
    let current: string | null = newParentId;
    const visited = new Set<string>();
    while (current) {
      if (current === menuId) return true;
      if (visited.has(current)) return true;
      visited.add(current);
      current = parentMap.get(current) ?? null;
    }
    return false;
  }

  private buildTree(menus: any[]): any[] {
    const map = new Map<string, any>();
    for (const m of menus) map.set(m.id, { ...m, children: [] });

    const roots: any[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sort = (items: any[]) => {
      items.sort((a, b) => a.order - b.order);
      items.forEach((i) => sort(i.children));
    };
    sort(roots);
    return roots;
  }
}
