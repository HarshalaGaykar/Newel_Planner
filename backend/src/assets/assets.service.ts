import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAssetDto: CreateAssetDto, userId: string) {
    const asset = await this.prisma.asset.create({
      data: {
        ...createAssetDto,
      },
    });

    await this.prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'CREATED',
        newStatus: asset.status,
        recordedById: userId,
        notes: 'Asset created',
      },
    });

    return asset;
  }

  async findAll(filters: {
    type?: any;
    status?: any;
    clientId?: string;
    locationId?: string;
    userId?: string; // Can be allocated to or currently used by
  }) {
    const where: any = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.userId) {
      where.OR = [
        { allocatedToId: filters.userId },
        { currentlyUsedById: filters.userId },
      ];
    }

    return this.prisma.asset.findMany({
      where,
      include: {
        client: true,
        location: true,
        allocatedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        currentlyUsedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        spokesperson: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        client: true,
        location: true,
        allocatedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        currentlyUsedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        spokesperson: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        history: {
          include: {
            recordedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) throw new NotFoundException(`Asset with ID ${id} not found`);
    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto, userId: string) {
    const asset = await this.findOne(id);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: updateAssetDto,
    });

    if (updateAssetDto.status && updateAssetDto.status !== asset.status) {
      await this.prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: 'STATUS_CHANGE',
          previousStatus: asset.status,
          newStatus: updateAssetDto.status,
          recordedById: userId,
          notes: updateAssetDto.notes || 'Status updated via edit',
        },
      });
    }

    return updated;
  }

  async assign(id: string, assignAssetDto: AssignAssetDto, userId: string) {
    const asset = await this.findOne(id);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        allocatedToId: assignAssetDto.allocatedToId !== undefined ? assignAssetDto.allocatedToId : asset.allocatedToId,
        currentlyUsedById: assignAssetDto.currentlyUsedById !== undefined ? assignAssetDto.currentlyUsedById : asset.currentlyUsedById,
        locationId: assignAssetDto.locationId !== undefined ? assignAssetDto.locationId : asset.locationId,
        status: assignAssetDto.status !== undefined ? assignAssetDto.status : asset.status,
      },
    });

    let action = 'REASSIGNED';
    if (!asset.allocatedToId && assignAssetDto.allocatedToId) action = 'ALLOCATED';
    if (asset.allocatedToId && assignAssetDto.allocatedToId === null) action = 'RETURNED';

    await this.prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action,
        previousUserId: asset.currentlyUsedById || asset.allocatedToId,
        newUserId: updated.currentlyUsedById || updated.allocatedToId,
        previousStatus: asset.status,
        newStatus: updated.status,
        recordedById: userId,
        notes: assignAssetDto.notes || `Asset reassigned`,
      },
    });

    return updated;
  }

  async remove(id: string) {
    return this.prisma.asset.delete({
      where: { id },
    });
  }
}
