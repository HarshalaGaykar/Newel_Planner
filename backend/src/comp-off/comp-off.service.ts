import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompOffDto } from './dto/create-comp-off.dto';

const STANDARD_WORK_HOURS = 9;

@Injectable()
export class CompOffService {
  constructor(private prisma: PrismaService) {}

  async findAll(actorId: string, actorRole: string, userId?: string) {
    const allowedIds = await this.resolveCompOffUserIds(actorId, actorRole);

    const where: any = {};
    if (userId) {
      if (userId !== actorId && allowedIds && !allowedIds.includes(userId)) {
        throw new ForbiddenException('You are not allowed to view this user comp-off records');
      }
      where.userId = userId;
    } else if (allowedIds) {
      where.userId = { in: allowedIds };
    }

    return this.prisma.compOff.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, reportingAuthorityId: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const compOff = await this.prisma.compOff.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, reportingAuthorityId: true },
        },
      },
    });
    if (!compOff) throw new NotFoundException(`CompOff record "${id}" not found`);
    return compOff;
  }

  async create(dto: CreateCompOffDto, actorId: string, actorRole: string) {
    if (dto.userId !== actorId && !this.canAdminManage(actorRole)) {
      throw new ForbiddenException('You can only request comp-off for yourself');
    }

    if (dto.hoursWorked <= STANDARD_WORK_HOURS) {
      throw new BadRequestException(
        `CompOff only applicable if hours worked exceed standard ${STANDARD_WORK_HOURS}h. Provided: ${dto.hoursWorked}h`,
      );
    }

    const extraHours = dto.hoursWorked - STANDARD_WORK_HOURS;
    const date = new Date(dto.date);

    return this.prisma.compOff.create({
      data: { userId: dto.userId, date, hoursWorked: dto.hoursWorked, extraHours },
    });
  }

  async approve(id: string, approverId: string, approverRole: string) {
    const record = await this.findOne(id);
    if (record.status !== 'PENDING') {
      throw new BadRequestException(`CompOff is already ${record.status}`);
    }
    this.assertCanApprove(record, approverId, approverRole);
    return this.prisma.compOff.update({ where: { id }, data: { status: 'APPROVED' } });
  }

  async reject(id: string, approverId: string, approverRole: string) {
    const record = await this.findOne(id);
    if (record.status !== 'PENDING') {
      throw new BadRequestException(`CompOff is already ${record.status}`);
    }
    this.assertCanApprove(record, approverId, approverRole);
    return this.prisma.compOff.update({ where: { id }, data: { status: 'REJECTED' } });
  }

  async markUtilised(id: string, actorId: string, actorRole: string) {
    const record = await this.findOne(id);
    if (record.status !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED comp-offs can be marked as utilised');
    }
    if (record.userId !== actorId && !this.canAdminManage(actorRole)) {
      throw new ForbiddenException('Only the requester can mark this comp-off as utilised');
    }
    return this.prisma.compOff.update({ where: { id }, data: { status: 'UTILISED' } });
  }

  async remove(id: string, actorId: string, actorRole: string) {
    const record = await this.findOne(id);
    if (record.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING comp-offs can be deleted');
    }
    if (record.userId !== actorId && !this.canAdminManage(actorRole)) {
      throw new ForbiddenException('Only the requester can delete this comp-off request');
    }
    return this.prisma.compOff.delete({ where: { id } });
  }

  private async resolveCompOffUserIds(actorId: string, actorRole: string) {
    if (this.canAdminManage(actorRole)) {
      return null;
    }

    const directReports = await this.prisma.user.findMany({
      where: { reportingAuthorityId: actorId, isActive: true },
      select: { id: true },
    });

    return [actorId, ...directReports.map((user) => user.id)];
  }

  private assertCanApprove(
    record: { userId: string; user?: { reportingAuthorityId?: string | null } },
    approverId: string,
    approverRole: string,
  ) {
    if (record.userId === approverId) {
      throw new ForbiddenException('You cannot approve or reject your own comp-off request');
    }

    if (this.canAdminManage(approverRole)) {
      return;
    }

    if (record.user?.reportingAuthorityId !== approverId) {
      throw new ForbiddenException(
        'Only the requester reporting authority can approve or reject this comp-off request',
      );
    }
  }

  private canAdminManage(role: string) {
    return ['ADMIN', 'HR'].includes(role);
  }
}
