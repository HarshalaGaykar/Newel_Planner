import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpokespersonDto } from './dto/create-spokesperson.dto';

@Injectable()
export class SpokespersonsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active spokespersons for a client, alphabetical. */
  async findByClient(clientId: string) {
    if (!clientId) throw new BadRequestException('clientId is required');
    return this.prisma.spokesperson.findMany({
      where: { clientId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a spokesperson for a client, or return/reactivate an existing one so a
   * name is never duplicated for the same client (case-insensitive). A soft-deleted
   * match is reactivated rather than creating a new row.
   */
  async create(dto: CreateSpokespersonDto, userId: string) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name is required');

    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException(`Client with ID ${dto.clientId} not found`);

    const existing = await this.prisma.spokesperson.findFirst({
      where: { clientId: dto.clientId, name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      if (existing.isActive) return existing;
      // Reactivate a previously soft-deleted spokesperson instead of duplicating.
      return this.prisma.spokesperson.update({
        where: { id: existing.id },
        data: { isActive: true, name, updatedById: userId },
      });
    }

    return this.prisma.spokesperson.create({
      data: { name, clientId: dto.clientId, createdById: userId, updatedById: userId },
    });
  }
}
