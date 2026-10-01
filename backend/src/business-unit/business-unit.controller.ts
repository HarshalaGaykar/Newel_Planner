import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { BusinessUnitService } from './business-unit.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';

@ApiTags('Business Units')
@ApiBearerAuth()
@Controller({ path: 'business-units', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BusinessUnitController {
  constructor(private businessUnitService: BusinessUnitService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all business units' })
  findAll() {
    return this.businessUnitService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single business unit by ID' })
  findOne(@Param('id') id: string) {
    return this.businessUnitService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new business unit' })
  create(@Body() dto: CreateBusinessUnitDto) {
    return this.businessUnitService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing business unit by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessUnitDto) {
    return this.businessUnitService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a business unit by ID' })
  remove(@Param('id') id: string) {
    return this.businessUnitService.remove(id);
  }
}
