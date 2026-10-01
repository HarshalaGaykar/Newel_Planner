import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberSeriesService } from '../admin-config/number-series.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { CreateVendorContactDto } from './dto/create-vendor-contact.dto';
import { VendorCategory, VendorStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    private seriesService: NumberSeriesService,
  ) {}

  async create(createVendorDto: CreateVendorDto) {
    const vendorCode = await this.seriesService.generateCode('VENDOR');
    
    if (createVendorDto.rateCards) {
      this.validateRateCards(createVendorDto.rateCards);
    }

    return this.prisma.vendor.create({
      data: {
        ...createVendorDto,
        vendorCode,
      },
    });
  }

  async findAll(query: { category?: VendorCategory; status?: VendorStatus }) {
    return this.prisma.vendor.findMany({
      where: {
        isActive: true,
        ...(query.category && { category: query.category }),
        ...(query.status && { status: query.status }),
      },
      include: {
        _count: {
          select: { freelancers: true },
        },
      },
    });
  }

  async findExpiring() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return this.prisma.vendor.findMany({
      where: {
        isActive: true,
        agreementEnd: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
      },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        contacts: true,
        freelancers: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!vendor || !vendor.isActive) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    return vendor;
  }

  async update(id: string, updateVendorDto: UpdateVendorDto) {
    if (updateVendorDto.rateCards) {
      this.validateRateCards(updateVendorDto.rateCards);
    }

    return this.prisma.vendor.update({
      where: { id },
      data: updateVendorDto,
    });
  }

  async remove(id: string) {
    return this.prisma.vendor.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async addContact(vendorId: string, createContactDto: CreateVendorContactDto) {
    return this.prisma.vendorContact.create({
      data: {
        ...createContactDto,
        vendorId,
      },
    });
  }

  async removeContact(contactId: string) {
    return this.prisma.vendorContact.delete({
      where: { id: contactId },
    });
  }

  private validateRateCards(rateCards: any[]) {
    if (!Array.isArray(rateCards)) {
      throw new BadRequestException('rateCards must be an array');
    }

    for (const card of rateCards) {
      if (!card.role || card.rate === undefined || !card.currency) {
        throw new BadRequestException('Each rate card must have role, rate, and currency');
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAgreementExpiry() {
    const today = new Date();
    await this.prisma.vendor.updateMany({
      where: {
        agreementEnd: {
          lt: today,
        },
        status: {
          not: VendorStatus.INACTIVE,
        },
      },
      data: {
        status: VendorStatus.INACTIVE,
      },
    });
  }
}
