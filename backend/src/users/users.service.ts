import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { EmploymentStatus } from './dto/employment-status.enum';
import { NumberSeriesService } from '../admin-config/number-series.service';
import { ScopeResolverService } from '../common/scope-resolver.service';
import * as bcrypt from 'bcrypt';

// Status transitions: key → allowed next statuses
const STATUS_TRANSITIONS: Record<EmploymentStatus, EmploymentStatus[]> = {
  [EmploymentStatus.DRAFT]:      [EmploymentStatus.ACTIVE],
  [EmploymentStatus.ACTIVE]:     [EmploymentStatus.INACTIVE, EmploymentStatus.RESIGNED, EmploymentStatus.TERMINATED],
  [EmploymentStatus.INACTIVE]:   [EmploymentStatus.ACTIVE, EmploymentStatus.RESIGNED],
  [EmploymentStatus.RESIGNED]:   [],
  [EmploymentStatus.TERMINATED]: [],
};

const USER_SELECT = {
  id: true,
  email: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  isActive: true,
  employmentStatus: true,
  baseCostPerHour: true,
  billingRatePerHour: true,
  mobile: true,
  dateOfJoining: true,
  designation: true,
  grade: true,
  failedAttempts: true,
  avatarUrl: true,
  locationId: true,
  shiftId: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  reportingAuthorityId: true,
  reportingAuthority: { select: { id: true, firstName: true, lastName: true, email: true } },
  location: { select: { id: true, name: true, city: true, country: true } },
  shift: { select: { id: true, name: true, startTime: true, endTime: true } },
  skills: { select: { skill: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private seriesService: NumberSeriesService,
    private scopeResolver: ScopeResolverService,
  ) {}

  async findAll(actorId: string, actorRole: string) {
    const scope = await this.scopeResolver.getDataScope(actorRole, 'USER_READ');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    const where: any = {};
    if (allowedIds) {
      where.id = { in: allowedIds };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(this.formatUser);
  }

  async findTeamMembers(actorId: string, actorRole: string) {
    // For picking team members, we use the same scoping as USER_READ
    const scope = await this.scopeResolver.getDataScope(actorRole, 'USER_READ');
    const allowedIds = await this.scopeResolver.resolveAllowedUserIds(actorId, scope);

    const where: any = { isActive: true };
    if (allowedIds) {
      where.id = { in: allowedIds };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { firstName: 'asc' },
    });
    return users;
  }

  // Minimal list of PM-eligible users for assignment dropdowns (project creation).
  // Returns all active ADMIN/PM/TL users, plus the current user (so a creator —
  // e.g. an RA — can assign themselves as PM). Only id + name; no PII.
  findManagers(actorId: string) {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: { name: { in: ['ADMIN', 'PM', 'TL'] } } },
          { id: actorId },
        ],
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  // All active users selectable as allocation resources. Includes email so the
  // resource picker can disambiguate people. Only minimal identifying fields.
  findAllocatableResources() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  // Active users assignable to tasks — workforce roles (PM/TL/USER/HR).
  // Only minimal identifying fields; no PII beyond name.
  findAssignableUsers() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: { name: { in: ['PM', 'TL', 'USER', 'HR'] } } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findTaskAssignees(_actorId: string, _actorRole: string, projectId?: string) {
    if (!projectId) return [];

    const where: any = {
      projectId,
      userId: { not: null },
      user: { isActive: true },
    };

    const allocations = await this.prisma.allocation.findMany({
      where,
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });

    const seen = new Set<string>();
    const users: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      role: { name: string } | null;
    }> = [];
    for (const allocation of allocations) {
      if (!allocation.user || seen.has(allocation.user.id)) continue;
      seen.add(allocation.user.id);
      users.push(allocation.user);
    }
    return users;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException(`User "${id}" not found`);
    return this.formatUser(user);
  }

  async findByStatus(status: EmploymentStatus) {
    const users = await this.prisma.user.findMany({
      where: { employmentStatus: status as any },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(this.formatUser);
  }

  async create(dto: CreateUserDto, actorId: string, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`Email "${dto.email}" is already registered`);

    if (dto.employeeCode) {
      const existingCode = await this.prisma.user.findUnique({ where: { employeeCode: dto.employeeCode } });
      if (existingCode) throw new ConflictException(`Employee Code "${dto.employeeCode}" is already in use`);
    }

    const employeeCode = dto.employeeCode || (await this.seriesService.generateCode('EMPLOYEE'));

    await this.assertRoleExists(dto.roleId);
    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);
    if (dto.skillIds?.length) await this.assertSkillsExist(dto.skillIds);

    const hashed = await bcrypt.hash(dto.password, 10);
    const empStatus = dto.employmentStatus ?? EmploymentStatus.ACTIVE;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
        employeeCode,
        departmentId: dto.departmentId ?? null,
        reportingAuthorityId: dto.reportingAuthorityId ?? null,
        baseCostPerHour: dto.baseCostPerHour ?? 0,
        billingRatePerHour: dto.billingRatePerHour ?? 0,
        isActive: empStatus === EmploymentStatus.ACTIVE,
        employmentStatus: empStatus as any,
        mobile: dto.mobile ?? null,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
        designation: dto.designation ?? null,
        grade: dto.grade ?? null,
        locationId: dto.locationId ?? null,
        shiftId: dto.shiftId ?? null,
        skills: dto.skillIds?.length
          ? { create: dto.skillIds.map((skillId) => ({ skillId })) }
          : undefined,
      },
      select: USER_SELECT,
    });

    await this.audit('CREATE_USER', actorId, { userId: user.id, email: user.email }, ipAddress);

    return this.formatUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User "${id}" not found`);

    if (dto.email && dto.email !== existing.email) {
      const taken = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (taken) throw new ConflictException(`Email "${dto.email}" is already registered`);
    }

    if (dto.employeeCode && dto.employeeCode !== existing.employeeCode) {
      const takenCode = await this.prisma.user.findUnique({ where: { employeeCode: dto.employeeCode } });
      if (takenCode) throw new ConflictException(`Employee Code "${dto.employeeCode}" is already in use`);
    }

    if (dto.roleId) await this.assertRoleExists(dto.roleId);
    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);
    if (dto.skillIds?.length) await this.assertSkillsExist(dto.skillIds);

    const data: Record<string, unknown> = {};
    if (dto.email !== undefined)               data.email = dto.email;
    if (dto.employeeCode !== undefined)        data.employeeCode = dto.employeeCode;
    if (dto.firstName !== undefined)           data.firstName = dto.firstName;
    if (dto.lastName !== undefined)            data.lastName = dto.lastName;
    if (dto.roleId !== undefined)              data.roleId = dto.roleId;
    if (dto.departmentId !== undefined)        data.departmentId = dto.departmentId;
    if (dto.reportingAuthorityId !== undefined) data.reportingAuthorityId = dto.reportingAuthorityId;
    if (dto.baseCostPerHour !== undefined)     data.baseCostPerHour = dto.baseCostPerHour;
    if (dto.billingRatePerHour !== undefined)  data.billingRatePerHour = dto.billingRatePerHour;
    if (dto.mobile !== undefined)              data.mobile = dto.mobile;
    if (dto.dateOfJoining !== undefined)       data.dateOfJoining = dto.dateOfJoining ? new Date(dto.dateOfJoining) : null;
    if (dto.designation !== undefined)         data.designation = dto.designation;
    if (dto.grade !== undefined)               data.grade = dto.grade;
    if (dto.locationId !== undefined)          data.locationId = dto.locationId;
    if (dto.shiftId !== undefined)             data.shiftId = dto.shiftId;
    if (dto.isActive !== undefined)            data.isActive = dto.isActive;
    if (dto.password !== undefined)            data.password = await bcrypt.hash(dto.password, 10);

    // Status transition validation
    if (dto.employmentStatus !== undefined) {
      const currentStatus = existing.employmentStatus as unknown as EmploymentStatus;
      const newStatus = dto.employmentStatus;

      if (currentStatus !== newStatus) {
        const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
        if (!allowed.includes(newStatus)) {
          throw new BadRequestException(
            `Cannot transition employment status from ${currentStatus} to ${newStatus}`,
          );
        }

        data.employmentStatus = newStatus;
        data.isActive = newStatus === EmploymentStatus.ACTIVE;

        await this.audit('STATUS_CHANGE', actorId, {
          userId: id,
          from: currentStatus,
          to: newStatus,
        }, ipAddress);
      } else if (
        newStatus === EmploymentStatus.ACTIVE &&
        !existing.isActive &&
        data.isActive === undefined
      ) {
        // Users deactivated before the status was recorded alongside isActive
        // still read ACTIVE, so this is not a transition — but re-selecting
        // ACTIVE must still restore their login rather than do nothing.
        data.isActive = true;
      }
    }

    // Sync skills when provided
    if (dto.skillIds !== undefined) {
      await this.prisma.userSkill.deleteMany({ where: { userId: id } });
      if (dto.skillIds.length) {
        await this.prisma.userSkill.createMany({
          data: dto.skillIds.map((skillId) => ({ userId: id, skillId })),
        });
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });

    await this.audit('UPDATE_USER', actorId, { userId: id, changes: dto }, ipAddress);

    return this.formatUser(user);
  }

  async remove(id: string, actorId: string, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User "${id}" not found`);

    await this.audit('DEACTIVATE_USER', actorId, { userId: id, email: existing.email }, ipAddress);

    // Record the employment status too. Flipping only isActive left the user
    // reading ACTIVE while unable to log in — a state no list could render
    // coherently, and one that could not be undone: re-selecting ACTIVE is a
    // no-op transition, so isActive was never restored. Statuses that already
    // describe an exit (RESIGNED / TERMINATED) are left as they are.
    const data: { isActive: boolean; employmentStatus?: EmploymentStatus } = { isActive: false };
    if (existing.employmentStatus === EmploymentStatus.ACTIVE) {
      data.employmentStatus = EmploymentStatus.INACTIVE;
    }

    await this.prisma.user.update({ where: { id }, data: data as any });
    return { message: 'User deactivated' };
  }

  async unlock(id: string, actorId: string, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User "${id}" not found`);
    await this.prisma.user.update({ where: { id }, data: { isActive: true, failedAttempts: 0 } });
    await this.audit('UNLOCK_USER', actorId, { userId: id, email: existing.email }, ipAddress);
    return { message: 'User unlocked' };
  }

  async bulkUpload(dto: BulkUploadDto, actorId: string, ipAddress?: string) {
    const results: { email: string; status: 'created' | 'skipped'; reason?: string }[] = [];

    for (const userDto of dto.users) {
      try {
        await this.create(userDto, actorId, ipAddress);
        results.push({ email: userDto.email, status: 'created' });
      } catch (err: any) {
        results.push({ email: userDto.email, status: 'skipped', reason: err.message });
      }
    }

    return { total: dto.users.length, results };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private formatUser(user: any) {
    return {
      ...user,
      skills: user.skills.map((us: any) => us.skill),
    };
  }

  private async assertRoleExists(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new BadRequestException(`Role "${roleId}" not found`);
  }

  private async assertDepartmentExists(deptId: string) {
    const dept = await this.prisma.department.findUnique({ where: { id: deptId } });
    if (!dept) throw new BadRequestException(`Department "${deptId}" not found`);
  }

  private async assertSkillsExist(skillIds: string[]) {
    const found = await this.prisma.skill.findMany({ where: { id: { in: skillIds } } });
    if (found.length !== skillIds.length) {
      throw new BadRequestException('One or more skill IDs are invalid');
    }
  }

  private async audit(
    action: string,
    userId: string,
    details: Record<string, unknown>,
    ipAddress?: string,
  ) {
    await this.prisma.auditLog.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { action, module: 'USER', userId, details: details as any, ipAddress: ipAddress ?? null },
    });
  }
}
