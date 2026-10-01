import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';

@Injectable()
export class TestAttemptsService {
  constructor(private prisma: PrismaService) {}

  async start(dto: StartAttemptDto, userId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: dto.testId },
      include: { questions: { include: { question: true }, orderBy: { order: 'asc' } } },
    });
    if (!test) throw new NotFoundException('Test not found');
    if (test.status !== 'PUBLISHED') throw new BadRequestException('Test is not available');

    const existing = await this.prisma.testAttempt.findUnique({
      where: { testId_userId: { testId: dto.testId, userId } },
    });
    if (existing) {
      if (existing.status === 'IN_PROGRESS') return existing;
      throw new BadRequestException('You have already completed this test');
    }

    return this.prisma.testAttempt.create({
      data: { testId: dto.testId, userId, status: 'IN_PROGRESS' },
      include: {
        test: {
          include: {
            questions: {
              include: {
                question: {
                  select: {
                    id: true, text: true, type: true, options: true, marks: true, difficulty: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: true,
      },
    });
  }

  async getAttempt(attemptId: string, userId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            questions: {
              include: {
                question: {
                  select: {
                    id: true, text: true, type: true, options: true, marks: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException();

    if (attempt.status === 'IN_PROGRESS') {
      const elapsed = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000 / 60);
      if (elapsed >= attempt.test.duration) {
        return this.autoSubmit(attempt as any);
      }
    }
    return attempt;
  }

  async saveAnswer(attemptId: string, dto: SaveAnswerDto, userId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException();
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Attempt is not in progress');

    return this.prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      create: {
        attemptId,
        questionId: dto.questionId,
        selectedOptions: dto.selectedOptions as any,
      },
      update: {
        selectedOptions: dto.selectedOptions as any,
      },
    });
  }

  async submit(attemptId: string, userId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            questions: {
              include: { question: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException();
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Attempt already submitted');

    return this.grade(attempt as any);
  }

  private async autoSubmit(attempt: any) {
    return this.grade(attempt);
  }

  private async grade(attempt: any) {
    let totalEarned = 0;
    const answerUpdates: Promise<any>[] = [];

    for (const tq of attempt.test.questions) {
      const q = tq.question;
      const marksForQ = tq.marks ?? q.marks;
      const correctOptions: string[] = Array.isArray(q.correctOptions) ? q.correctOptions : [];
      const userAnswer = attempt.answers.find((a: any) => a.questionId === q.id);
      const selected: string[] = userAnswer ? (Array.isArray(userAnswer.selectedOptions) ? userAnswer.selectedOptions : []) : [];

      const isCorrect =
        correctOptions.length === selected.length &&
        correctOptions.every((opt: string) => selected.includes(opt));

      const marksObtained = isCorrect ? marksForQ : 0;
      if (isCorrect) totalEarned += marksForQ;

      if (userAnswer) {
        answerUpdates.push(
          this.prisma.attemptAnswer.update({
            where: { id: userAnswer.id },
            data: { isCorrect, marksObtained },
          }),
        );
      }
    }

    await Promise.all(answerUpdates);

    const percentage = (totalEarned / attempt.test.totalMarks) * 100;
    const passed = totalEarned >= attempt.test.passingMarks;

    return this.prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score: totalEarned,
        percentage,
        passed,
      },
      include: {
        answers: { include: { question: { select: { id: true, text: true, correctOptions: true, explanation: true } } } },
        test: { select: { title: true, totalMarks: true, passingMarks: true } },
      },
    });
  }

  async getMyTests(userId: string) {
    // Resolve assignments for this user (direct + dept + role)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, roleId: true },
    });

    const assignments = await this.prisma.testAssignment.findMany({
      where: {
        OR: [
          { target: 'USER', userId },
          { target: 'DEPARTMENT', departmentId: user?.departmentId ?? undefined },
          { target: 'ROLE', roleId: user?.roleId ?? undefined },
        ],
      },
      include: {
        test: {
          select: { id: true, title: true, duration: true, totalMarks: true, passingMarks: true, status: true, description: true },
        },
      },
    });

    const testIds = [...new Set(assignments.map((a) => a.testId))];
    const attempts = await this.prisma.testAttempt.findMany({
      where: { userId, testId: { in: testIds } },
      select: { id: true, testId: true, status: true, score: true, percentage: true, passed: true, submittedAt: true },
    });

    const attemptMap = new Map(attempts.map((a) => [a.testId, a]));

    return testIds.map((testId) => {
      const assignment = assignments.find((a) => a.testId === testId)!;
      return {
        ...assignment.test,
        dueDate: assignment.dueDate,
        attempt: attemptMap.get(testId) ?? null,
      };
    }).filter((t) => t.status === 'PUBLISHED');
  }

  async getResult(attemptId: string, userId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: { select: { title: true, totalMarks: true, passingMarks: true, duration: true } },
        answers: {
          include: {
            question: {
              select: { id: true, text: true, options: true, correctOptions: true, explanation: true, marks: true },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenException();
    if (attempt.status === 'IN_PROGRESS') throw new BadRequestException('Attempt not yet submitted');
    return attempt;
  }
}
