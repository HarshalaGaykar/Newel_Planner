import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  findByBank(bankId: string) {
    return this.prisma.question.findMany({
      where: { bankId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const q = await this.prisma.question.findUnique({ where: { id } });
    if (!q) throw new NotFoundException(`Question ${id} not found`);
    return q;
  }

  async create(dto: CreateQuestionDto) {
    const { bankId, options, correctOptions, tags, ...rest } = dto;
    return this.prisma.question.create({
      data: {
        ...rest,
        bank: { connect: { id: bankId } },
        options: options as any,
        correctOptions: correctOptions as any,
        tags: tags ?? [],
      },
    });
  }

  async createMany(bankId: string, questions: CreateQuestionDto[]) {
    return this.prisma.question.createMany({
      data: questions.map(q => {
        const { bankId: _, options, correctOptions, tags, ...rest } = q;
        return {
          ...rest,
          bankId,
          options: options as any,
          correctOptions: correctOptions as any,
          tags: tags ?? [],
        };
      }),
    });
  }

  async update(id: string, dto: UpdateQuestionDto) {
    await this.findOne(id);
    const { bankId, options, correctOptions, tags, ...rest } = dto;
    return this.prisma.question.update({
      where: { id },
      data: {
        ...rest,
        ...(options && { options: options as any }),
        ...(correctOptions && { correctOptions: correctOptions as any }),
        ...(tags && { tags }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.question.delete({ where: { id } });
  }
}
