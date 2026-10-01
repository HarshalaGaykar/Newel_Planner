import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { CostCenterService } from './cost-center.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@ApiTags('Cost Centers')
@ApiBearerAuth()
@Controller({ path: 'cost-centers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CostCenterController {
  constructor(private costCenterService: CostCenterService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all cost centers' })
  findAll() {
    return this.costCenterService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single cost center by ID' })
  findOne(@Param('id') id: string) {
    return this.costCenterService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new cost center' })
  create(@Body() dto: CreateCostCenterDto) {
    return this.costCenterService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing cost center by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.costCenterService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a cost center by ID' })
  remove(@Param('id') id: string) {
    return this.costCenterService.remove(id);
  }
}
