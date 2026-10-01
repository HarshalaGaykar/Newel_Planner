import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NumberSeriesService } from '../admin-config/number-series.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientContactDto } from './dto/client-contact.dto';

const CLIENT_INCLUDE = {
  currency: { select: { id: true, code: true, symbol: true } },
  contacts: { where: { isActive: true }, orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private seriesService: NumberSeriesService,
  ) {}

  private assertUniqueContactEmails(contacts?: ClientContactDto[]) {
    if (!contacts?.length) return;
    const seen = new Set<string>();
    for (const c of contacts) {
      const key = c.email.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate contact email "${c.email}" for this client`);
      }
      seen.add(key);
    }
  }

  async create(dto: CreateClientDto) {
    const { contacts, ...rest } = dto;
    this.assertUniqueContactEmails(contacts);
    const clientCode = await this.seriesService.generateCode('CLIENT');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const client = await tx.client.create({ data: { ...rest, clientCode } });
        if (contacts?.length) {
          await tx.clientContact.createMany({
            data: contacts.map((c) => ({
              clientId: client.id,
              name: c.name.trim(),
              email: c.email.trim().toLowerCase(),
              designation: c.designation,
              isActive: c.isActive ?? true,
            })),
          });
        }
        return tx.client.findUnique({ where: { id: client.id }, include: CLIENT_INCLUDE });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Duplicate contact email for this client');
      }
      throw e;
    }
  }

  findAll() {
    return this.prisma.client.findMany({
      include: CLIENT_INCLUDE,
      orderBy: { clientCode: 'asc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: CLIENT_INCLUDE,
    });
    if (!client) throw new NotFoundException(`Client "${id}" not found`);
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    const { contacts, ...rest } = dto;
    this.assertUniqueContactEmails(contacts);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (contacts !== undefined) {
          await tx.clientContact.deleteMany({ where: { clientId: id } });
          if (contacts.length) {
            await tx.clientContact.createMany({
              data: contacts.map((c) => ({
                clientId: id,
                name: c.name.trim(),
                email: c.email.trim().toLowerCase(),
                designation: c.designation,
                isActive: c.isActive ?? true,
              })),
            });
          }
        }
        await tx.client.update({ where: { id }, data: rest });
        return tx.client.findUnique({ where: { id }, include: CLIENT_INCLUDE });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Duplicate contact email for this client');
      }
      throw e;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
