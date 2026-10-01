import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberSeriesService } from '../admin-config/number-series.service';
import { CreateFreelancerDto } from './dto/create-freelancer.dto';
import { UpdateFreelancerDto } from './dto/update-freelancer.dto';
import { FreelancerStatus } from '@prisma/client';

@Injectable()
export class FreelancersService {
  constructor(
    private prisma: PrismaService,
    private seriesService: NumberSeriesService,
  ) {}

  private contractExpiryCheck(contractEnd: Date): Partial<{ status: FreelancerStatus; isActive: boolean }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (contractEnd < today) {
      return { status: FreelancerStatus.CONTRACT_EXPIRED, isActive: false };
    }
    return {};
  }

  async create(dto: CreateFreelancerDto) {
    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
      if (vendor && (vendor.status === 'BLACKLISTED' || vendor.status === 'INACTIVE')) {
        throw new BadRequestException(`Cannot add freelancer to a ${vendor.status} vendor`);
      }
    }
    const freelancerCode = await this.seriesService.generateCode('FREELANCER');
    const contractEnd = new Date(dto.contractEnd);
    const expiryOverride = this.contractExpiryCheck(contractEnd);

    return this.prisma.freelancer.create({
      data: {
        ...dto,
        freelancerCode,
        contractStart: new Date(dto.contractStart),
        contractEnd,
        ...expiryOverride,
      },
      include: { vendor: true, currency: true, skills: { include: { skill: true } } },
    });
  }

  findAll(vendorId?: string, status?: string, skillId?: string) {
    return this.prisma.freelancer.findMany({
      where: {
        vendorId: vendorId || undefined,
        status: status ? (status as FreelancerStatus) : undefined,
        skills: skillId ? { some: { skillId } } : undefined,
      },
      include: { vendor: true, currency: true, skills: { include: { skill: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findExpiring() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + 30);

    return this.prisma.freelancer.findMany({
      where: {
        isActive: true,
        status: FreelancerStatus.ACTIVE,
        contractEnd: { lte: threshold, gte: today },
      },
      include: { vendor: true, currency: true, skills: { include: { skill: true } } },
      orderBy: { contractEnd: 'asc' },
    });
  }

  async findOne(id: string) {
    const freelancer = await this.prisma.freelancer.findUnique({
      where: { id },
      include: { vendor: true, currency: true, skills: { include: { skill: true } } },
    });
    if (!freelancer) throw new NotFoundException(`Freelancer "${id}" not found`);
    return freelancer;
  }

  async update(id: string, dto: UpdateFreelancerDto) {
    await this.findOne(id);
    
    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
      if (vendor && (vendor.status === 'BLACKLISTED' || vendor.status === 'INACTIVE')) {
        throw new BadRequestException(`Cannot move freelancer to a ${vendor.status} vendor`);
      }
    }
    const contractEnd = dto.contractEnd ? new Date(dto.contractEnd) : undefined;
    const expiryOverride = contractEnd ? this.contractExpiryCheck(contractEnd) : {};

    return this.prisma.freelancer.update({
      where: { id },
      data: {
        ...dto,
        contractStart: dto.contractStart ? new Date(dto.contractStart) : undefined,
        contractEnd,
        ...expiryOverride,
      },
      include: { vendor: true, currency: true, skills: { include: { skill: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.freelancer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async assignSkills(id: string, skills: { skillId: string; level?: number }[]) {
    await this.findOne(id);
    await this.prisma.freelancerSkill.deleteMany({ where: { freelancerId: id } });
    if (skills.length > 0) {
      await this.prisma.freelancerSkill.createMany({
        data: skills.map(s => ({ freelancerId: id, skillId: s.skillId, level: s.level ?? 1 })),
      });
    }
    return this.findOne(id);
  }

  async canAllocate(freelancerId: string, allocationStartDate: Date, allocationEndDate: Date) {
    const freelancer = await this.prisma.freelancer.findUnique({ where: { id: freelancerId } });
    if (!freelancer) throw new NotFoundException(`Freelancer "${freelancerId}" not found`);
    if (!freelancer.isActive) throw new BadRequestException('Freelancer is not active');
    if (freelancer.contractEnd < allocationEndDate) {
      throw new BadRequestException('Freelancer contract expires before allocation end');
    }
  }
}
