import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { AddQuestionsDto } from './dto/add-questions.dto';
import { AssignTestDto } from './dto/assign-test.dto';

@Injectable()
export class TestsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.test.findMany({
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { questions: true, assignments: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        questions: {
          include: { question: true },
          orderBy: { order: 'asc' },
        },
        assignments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            department: { select: { id: true, name: true } },
            role: { select: { id: true, name: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });
    if (!test) throw new NotFoundException(`Test ${id} not found`);
    return test;
  }

  create(dto: CreateTestDto, userId: string) {
    return this.prisma.test.create({
      data: {
        ...dto,
        createdById: userId,
      },
    });
  }

  async update(id: string, dto: UpdateTestDto) {
    await this.findOne(id);
    return this.prisma.test.update({ where: { id }, data: dto });
  }

  async publish(id: string) {
    const test = await this.findOne(id);
    if (test.status !== 'DRAFT') throw new BadRequestException('Only DRAFT tests can be published');
    if (test.questions.length === 0) throw new BadRequestException('Test must have at least one question');
    return this.prisma.test.update({ where: { id }, data: { status: 'PUBLISHED' } });
  }

  async close(id: string) {
    await this.findOne(id);
    return this.prisma.test.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.test.delete({ where: { id } });
  }

  async addQuestions(testId: string, dto: AddQuestionsDto) {
    const test = await this.findOne(testId);
    if (test.status !== 'DRAFT') throw new BadRequestException('Cannot modify a published test');
    await this.prisma.testQuestion.deleteMany({ where: { testId } });
    return this.prisma.testQuestion.createMany({
      data: dto.questions.map((q) => ({
        testId,
        questionId: q.questionId,
        order: q.order,
        marks: q.marks ?? null,
      })),
    });
  }

  async assign(testId: string, dto: AssignTestDto) {
    await this.findOne(testId);
    return this.prisma.testAssignment.create({
      data: {
        testId,
        target: dto.target as any,
        userId: dto.userId ?? null,
        departmentId: dto.departmentId ?? null,
        roleId: dto.roleId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async removeAssignment(testId: string, assignmentId: string) {
    return this.prisma.testAssignment.delete({ where: { id: assignmentId } });
  }

  async getResults(testId: string) {
    await this.findOne(testId);
    return this.prisma.testAttempt.findMany({
      where: { testId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }
}
