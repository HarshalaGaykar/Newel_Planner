import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';

@Injectable()
export class QuestionBanksService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.questionBank.findMany({
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { questions: true, tests: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        questions: { orderBy: { createdAt: 'desc' } },
        _count: { select: { tests: true } },
      },
    });
    if (!bank) throw new NotFoundException(`Question bank ${id} not found`);
    return bank;
  }

  create(dto: CreateQuestionBankDto, userId: string) {
    return this.prisma.questionBank.create({
      data: { ...dto, createdById: userId },
    });
  }

  async update(id: string, dto: UpdateQuestionBankDto, userId: string) {
    const bank = await this.prisma.questionBank.findUnique({ where: { id } });
    if (!bank) throw new NotFoundException(`Question bank ${id} not found`);
    if (bank.createdById !== userId) throw new ForbiddenException();
    return this.prisma.questionBank.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const bank = await this.prisma.questionBank.findUnique({ where: { id } });
    if (!bank) throw new NotFoundException(`Question bank ${id} not found`);
    return this.prisma.questionBank.delete({ where: { id } });
  }
}
