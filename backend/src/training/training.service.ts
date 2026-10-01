import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { EnrollDto } from './dto/enroll.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ProgramQueryDto, SessionQueryDto } from './dto/query.dto';
import { EnrollmentStatus, NotificationType } from '@prisma/client';

@Injectable()
export class TrainingService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ── CATEGORIES ──────────────────────────────────────────────────────────────

  findAllCategories() {
    return this.prisma.trainingCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { programs: true } } },
    });
  }

  async findOneCategory(id: string) {
    const category = await this.prisma.trainingCategory.findUnique({
      where: { id },
      include: { programs: { where: { isActive: true } } },
    });
    if (!category) throw new NotFoundException(`Training category not found`);
    return category;
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.trainingCategory.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException(`Category "${dto.name}" already exists`);
    return this.prisma.trainingCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.findOneCategory(id);
    if (dto.name) {
      const taken = await this.prisma.trainingCategory.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (taken) throw new ConflictException(`Category "${dto.name}" already exists`);
    }
    return this.prisma.trainingCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(id: string) {
    await this.findOneCategory(id);
    return this.prisma.trainingCategory.delete({ where: { id } });
  }

  // ── PROGRAMS ─────────────────────────────────────────────────────────────────

  findAllPrograms(query: ProgramQueryDto) {
    const where: any = { isActive: true };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.type) where.type = query.type;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.trainingProgram.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        category: true,
        skills: { include: { skill: true } },
        _count: { select: { sessions: true } },
      },
    });
  }

  async findOneProgram(id: string) {
    const program = await this.prisma.trainingProgram.findUnique({
      where: { id },
      include: {
        category: true,
        skills: { include: { skill: true } },
        sessions: {
          orderBy: { startDate: 'desc' },
          include: { _count: { select: { enrollments: true } } },
        },
      },
    });
    if (!program) throw new NotFoundException(`Training program not found`);
    return program;
  }

  async createProgram(dto: CreateProgramDto) {
    const { skillIds, ...rest } = dto;
    return this.prisma.trainingProgram.create({
      data: {
        ...rest,
        skills: skillIds?.length
          ? { create: skillIds.map((skillId) => ({ skillId })) }
          : undefined,
      },
      include: { skills: { include: { skill: true } }, category: true },
    });
  }

  async updateProgram(id: string, dto: UpdateProgramDto) {
    await this.findOneProgram(id);
    const { skillIds, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (skillIds !== undefined) {
        await tx.trainingProgramSkill.deleteMany({ where: { programId: id } });
        if (skillIds.length) {
          await tx.trainingProgramSkill.createMany({
            data: skillIds.map((skillId) => ({ programId: id, skillId })),
          });
        }
      }
      return tx.trainingProgram.update({
        where: { id },
        data: rest,
        include: { skills: { include: { skill: true } }, category: true },
      });
    });
  }

  async removeProgram(id: string) {
    await this.findOneProgram(id);
    return this.prisma.trainingProgram.delete({ where: { id } });
  }

  // ── SESSIONS ─────────────────────────────────────────────────────────────────

  findAllSessions(query: SessionQueryDto) {
    const where: any = {};
    if (query.programId) where.programId = query.programId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.startDate = {};
      if (query.from) where.startDate.gte = new Date(query.from);
      if (query.to) where.startDate.lte = new Date(query.to);
    }
    return this.prisma.trainingSession.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        program: { include: { category: true } },
        trainer: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async findOneSession(id: string) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: {
        program: { include: { category: true, skills: { include: { skill: true } } } },
        trainer: { select: { id: true, firstName: true, lastName: true, email: true } },
        enrollments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, department: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException(`Training session not found`);
    return session;
  }

  async createSession(dto: CreateSessionDto) {
    const program = await this.prisma.trainingProgram.findUnique({
      where: { id: dto.programId },
    });
    if (!program) throw new NotFoundException(`Training program not found`);
    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException(`startDate must be before endDate`);
    }
    return this.prisma.trainingSession.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
      include: { program: true },
    });
  }

  async updateSession(id: string, dto: UpdateSessionDto) {
    await this.findOneSession(id);
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return this.prisma.trainingSession.update({ where: { id }, data });
  }

  async removeSession(id: string) {
    await this.findOneSession(id);
    return this.prisma.trainingSession.delete({ where: { id } });
  }

  // ── ENROLLMENTS ──────────────────────────────────────────────────────────────

  async enroll(sessionId: string, dto: EnrollDto, requesterId: string, requesterRole: string) {
    const isManager = requesterRole === 'ADMIN' || requesterRole === 'PM';
    const userIds = isManager ? dto.userIds : [requesterId];

    const session = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!session) throw new NotFoundException(`Training session not found`);
    if (session.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot enroll in a cancelled session`);
    }

    const existing = await this.prisma.trainingEnrollment.findMany({
      where: { sessionId, userId: { in: userIds } },
      select: { userId: true },
    });
    const alreadyEnrolled = existing.map((e) => e.userId);
    const toEnroll = userIds.filter((id) => !alreadyEnrolled.includes(id));

    if (!toEnroll.length) {
      throw new ConflictException(`All users are already enrolled in this session`);
    }

    const currentCount = session._count.enrollments;
    const willExceedCapacity =
      session.maxCapacity !== null &&
      currentCount + toEnroll.length > session.maxCapacity;

    const status: EnrollmentStatus = willExceedCapacity ? 'WAITLISTED' : 'ENROLLED';

    await this.prisma.trainingEnrollment.createMany({
      data: toEnroll.map((userId) => ({ sessionId, userId, status })),
    });

    return { enrolled: toEnroll.length, status, skipped: alreadyEnrolled };
  }

  findSessionEnrollments(sessionId: string) {
    return this.prisma.trainingEnrollment.findMany({
      where: { sessionId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'asc' },
    });
  }

  async updateEnrollment(
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
    requesterId: string,
    requesterRole: string,
  ) {
    const isManager = requesterRole === 'ADMIN' || requesterRole === 'PM';

    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        session: {
          include: {
            program: { include: { skills: true } },
          },
        },
      },
    });
    if (!enrollment) throw new NotFoundException(`Enrollment not found`);

    if (!isManager) {
      if (enrollment.userId !== requesterId) {
        throw new ForbiddenException(`You can only update your own enrollment`);
      }
      if (dto.status && dto.status !== 'IN_PROGRESS') {
        throw new BadRequestException(`Users can only set their status to IN_PROGRESS`);
      }
    }

    const data: any = { status: dto.status };
    if (dto.remarks !== undefined) data.remarks = dto.remarks;

    if (dto.status !== 'COMPLETED') {
      return this.prisma.trainingEnrollment.update({ where: { id: enrollmentId }, data });
    }

    // ── COMPLETION FLOW ───────────────────────────────────────────────────────
    data.completedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.trainingEnrollment.update({ where: { id: enrollmentId }, data });

      // Issue certificate (idempotent)
      const existingCert = await tx.trainingCertificate.findUnique({
        where: { enrollmentId },
      });
      if (!existingCert) {
        const year = new Date().getFullYear();
        const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
        await tx.trainingCertificate.create({
          data: {
            enrollmentId,
            userId: enrollment.userId,
            programId: enrollment.session.programId,
            sessionId: enrollment.sessionId,
            certificateNo: `CERT-${year}-${rand}`,
          },
        });
      }

      // Skill auto-upgrade for all skills linked to the program
      for (const { skillId } of enrollment.session.program.skills) {
        const existing = await tx.userSkill.findUnique({
          where: { userId_skillId: { userId: enrollment.userId, skillId } },
        });
        if (existing) {
          await tx.userSkill.update({
            where: { userId_skillId: { userId: enrollment.userId, skillId } },
            data: { level: Math.min(existing.level + 1, 10) },
          });
        } else {
          await tx.userSkill.create({
            data: { userId: enrollment.userId, skillId, level: 1 },
          });
        }
      }

      return updated;
    });

    // Send notification outside transaction (fire-and-forget)
    this.notificationsService
      .send(
        enrollment.userId,
        NotificationType.TRAINING_COMPLETED,
        'Training Completed',
        `Congratulations! You have completed "${enrollment.session.program.name}". Your certificate has been issued.`,
        { entityType: 'training_enrollment', entityId: enrollmentId, link: '/training' },
      )
      .catch(() => {});

    return result;
  }

  async removeEnrollment(enrollmentId: string) {
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException(`Enrollment not found`);
    return this.prisma.trainingEnrollment.delete({ where: { id: enrollmentId } });
  }

  findMyEnrollments(userId: string) {
    return this.prisma.trainingEnrollment.findMany({
      where: { userId },
      orderBy: { enrolledAt: 'desc' },
      include: {
        session: {
          include: {
            program: { include: { category: true, skills: { include: { skill: true } } } },
            trainer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        certificate: true,
        feedback: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
  }

  // ── CERTIFICATES ─────────────────────────────────────────────────────────────

  getMyCertificates(userId: string) {
    return this.prisma.trainingCertificate.findMany({
      where: { userId },
      include: {
        program: { select: { id: true, name: true, type: true } },
        session: { select: { id: true, title: true, startDate: true, endDate: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ── FEEDBACK ─────────────────────────────────────────────────────────────────

  async submitFeedback(enrollmentId: string, userId: string, dto: CreateFeedbackDto) {
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException(`Enrollment not found`);
    if (enrollment.userId !== userId) {
      throw new ForbiddenException(`You can only submit feedback for your own enrollment`);
    }
    if (enrollment.status !== 'COMPLETED') {
      throw new BadRequestException(`Feedback can only be submitted after completing the training`);
    }

    const existing = await this.prisma.trainingFeedback.findUnique({
      where: { enrollmentId },
    });
    if (existing) throw new ConflictException(`Feedback already submitted for this enrollment`);

    return this.prisma.trainingFeedback.create({
      data: {
        enrollmentId,
        userId,
        sessionId: enrollment.sessionId,
        rating: dto.rating,
        trainerRating: dto.trainerRating,
        contentRating: dto.contentRating,
        comments: dto.comments,
      },
    });
  }

  async getEnrollmentFeedback(enrollmentId: string) {
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException(`Enrollment not found`);
    return this.prisma.trainingFeedback.findUnique({ where: { enrollmentId } });
  }

  async getSessionFeedback(sessionId: string) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException(`Training session not found`);

    const feedbacks = await this.prisma.trainingFeedback.findMany({
      where: { sessionId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const avg = (field: 'rating' | 'trainerRating' | 'contentRating') => {
      const values = feedbacks.map((f) => f[field]).filter((v): v is number => v !== null);
      return values.length
        ? +( values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
        : null;
    };

    return {
      count: feedbacks.length,
      avgRating: avg('rating'),
      avgTrainerRating: avg('trainerRating'),
      avgContentRating: avg('contentRating'),
      feedbacks,
    };
  }
}
