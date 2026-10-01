import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Roles, Permissions } from '../auth/decorators/rbac.decorator';
import { Role, Permission } from '../auth/constants/rbac.constants';
import { DeliveryStageMasterService } from './delivery-stage-master.service';
import { CreateDeliveryStageDto } from './dto/create-delivery-stage.dto';
import { UpdateDeliveryStageDto } from './dto/update-delivery-stage.dto';

@ApiTags('Delivery Stage Master')
@ApiBearerAuth()
@Controller({ path: 'delivery-stages', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DeliveryStageMasterController {
  constructor(private readonly service: DeliveryStageMasterService) {}

  // Reading the list is gated on TRACKER_VIEW rather than a new permission:
  // anyone who can open the tracker needs it to render the stage dropdown.
  @Get()
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'List delivery stages, optionally only the active ones' })
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAll(activeOnly === 'true');
  }

  @Get(':id')
  @Permissions(Permission.TRACKER_VIEW)
  @ApiOperation({ summary: 'Get a single delivery stage by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Maintaining the master list is admin-only, matching the other master tables.
  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a delivery stage' })
  create(@Body() dto: CreateDeliveryStageDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a delivery stage' })
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryStageDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a delivery stage that is not in use' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
