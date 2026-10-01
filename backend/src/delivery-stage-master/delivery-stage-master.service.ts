import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryStageDto } from './dto/create-delivery-stage.dto';
import { UpdateDeliveryStageDto } from './dto/update-delivery-stage.dto';

@Injectable()
export class DeliveryStageMasterService {
  constructor(private prisma: PrismaService) {}

  /**
   * `activeOnly` is what the tracker dropdown asks for — a retired stage must
   * stay readable on the items already using it, but must not be offered again.
   */
  findAll(activeOnly = false) {
    return this.prisma.deliveryStageMaster.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const stage = await this.prisma.deliveryStageMaster.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException(`Delivery stage "${id}" not found`);
    return stage;
  }

  async create(dto: CreateDeliveryStageDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.deliveryStageMaster.findUnique({ where: { name } });
    if (existing) throw new ConflictException(`Delivery stage "${name}" already exists`);
    return this.prisma.deliveryStageMaster.create({ data: { ...dto, name } });
  }

  async update(id: string, dto: UpdateDeliveryStageDto) {
    const stage = await this.findOne(id);

    const name = dto.name?.trim();
    if (name && name !== stage.name) {
      const taken = await this.prisma.deliveryStageMaster.findUnique({ where: { name } });
      if (taken) throw new ConflictException(`Delivery stage "${name}" already exists`);
    }

    return this.prisma.deliveryStageMaster.update({
      where: { id },
      data: { ...dto, ...(name ? { name } : {}) },
    });
  }

  /**
   * Deleting a stage still in use would blank the stage on those items (the FK is
   * ON DELETE SET NULL), silently losing data. Refuse, and point at deactivating
   * instead — which keeps history intact and removes it from the dropdown.
   */
  async remove(id: string) {
    await this.findOne(id);

    const inUse = await this.prisma.deliveryItem.count({ where: { stageId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `This stage is used by ${inUse} delivery item${inUse === 1 ? '' : 's'}. Deactivate it instead of deleting it.`,
      );
    }

    return this.prisma.deliveryStageMaster.delete({ where: { id } });
  }
}
