import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { ProfitCenterService } from './profit-center.service';
import { CreateProfitCenterDto } from './dto/create-profit-center.dto';
import { UpdateProfitCenterDto } from './dto/update-profit-center.dto';

@ApiTags('Profit Centers')
@ApiBearerAuth()
@Controller({ path: 'profit-centers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ProfitCenterController {
  constructor(private profitCenterService: ProfitCenterService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all profit centers' })
  findAll() {
    return this.profitCenterService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single profit center by ID' })
  findOne(@Param('id') id: string) {
    return this.profitCenterService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new profit center' })
  create(@Body() dto: CreateProfitCenterDto) {
    return this.profitCenterService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing profit center by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateProfitCenterDto) {
    return this.profitCenterService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a profit center by ID' })
  remove(@Param('id') id: string) {
    return this.profitCenterService.remove(id);
  }
}
