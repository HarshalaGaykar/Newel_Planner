import { Injectable } from '@nestjs/common';
import { DataScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScopeResolverService {
  constructor(private prisma: PrismaService) {}

  async resolveAllowedUserIds(actorId: string, dataScope: DataScope): Promise<string[] | null> {
    switch (dataScope) {
      case DataScope.OWN:
        return [actorId];

      case DataScope.TEAM: {
        const subordinates = await this.prisma.user.findMany({
          where: { reportingAuthorityId: actorId },
          select: { id: true },
        });
        return [actorId, ...subordinates.map(u => u.id)];
      }

      case DataScope.DEPARTMENT: {
        const actor = await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { departmentId: true },
        });
        const deptUsers = await this.prisma.user.findMany({
          where: { departmentId: actor?.departmentId ?? undefined },
          select: { id: true },
        });
        return deptUsers.map(u => u.id);
      }

      case DataScope.PROJECT: {
        const actorAllocations = await this.prisma.allocation.findMany({
          where: { userId: actorId },
          select: { projectId: true },
        });
        const projectIds = actorAllocations.map(a => a.projectId);
        const projectUsers = await this.prisma.allocation.findMany({
          where: { projectId: { in: projectIds } },
          select: { userId: true },
        });
        const ids = projectUsers.map(u => u.userId).filter((id): id is string => id !== null);
        return [...new Set(ids)];
      }

      case DataScope.ALL:
        return null;
    }
  }

  async getDataScope(actorRole: string, permissionName: string): Promise<DataScope> {
    const rolePermission = await this.prisma.rolePermission.findFirst({
      where: {
        role: { name: actorRole },
        permission: { name: permissionName },
      },
    });
    return (rolePermission?.dataScope as DataScope) ?? DataScope.OWN;
  }
}
