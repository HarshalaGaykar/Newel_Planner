import { Injectable, NotFoundException } from '@nestjs/common';
import { RiskImpact, RiskProbability, RiskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';

const PROB_WEIGHTS: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4 };
const IMPACT_WEIGHTS: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

const RISK_INCLUDE = {
  owner: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class RisksService {
  constructor(private prisma: PrismaService) {}

  calculateRiskScore(probability: string, impact: string): number {
    return (PROB_WEIGHTS[probability] ?? 1) * (IMPACT_WEIGHTS[impact] ?? 1);
  }

  async create(dto: CreateRiskDto) {
    const { dueDate, projectId, probability, impact, status, ...rest } = dto;
    return this.prisma.risk.create({
      data: {
        ...rest,
        projectId,
        probability: probability as RiskProbability,
        impact: impact as RiskImpact,
        status: status as RiskStatus,
        riskScore: this.calculateRiskScore(probability, impact),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      },
      include: RISK_INCLUDE,
    });
  }

  findAll(projectId?: string, status?: string) {
    return this.prisma.risk.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: RISK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const risk = await this.prisma.risk.findUnique({ where: { id }, include: RISK_INCLUDE });
    if (!risk) throw new NotFoundException(`Risk ${id} not found`);
    return risk;
  }

  async update(id: string, dto: UpdateRiskDto) {
    const existing = await this.findOne(id);
    const probability = dto.probability ?? existing.probability;
    const impact = dto.impact ?? existing.impact;
    const { dueDate, projectId, ownerId, status, ...rest } = dto;
    
    return this.prisma.risk.update({
      where: { id },
      data: {
        ...rest,
        probability: probability as RiskProbability,
        impact: impact as RiskImpact,
        status: status as RiskStatus,
        riskScore: this.calculateRiskScore(probability, impact),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
      include: RISK_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.risk.delete({ where: { id } });
  }
}
