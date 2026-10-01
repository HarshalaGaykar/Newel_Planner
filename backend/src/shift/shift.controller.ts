import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { ShiftService } from './shift.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@ApiTags('Shifts')
@ApiBearerAuth()
@Controller({ path: 'shifts', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ShiftController {
  constructor(private shiftService: ShiftService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all shifts' })
  findAll() {
    return this.shiftService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single shift by ID' })
  findOne(@Param('id') id: string) {
    return this.shiftService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new shift' })
  create(@Body() dto: CreateShiftDto) {
    return this.shiftService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing shift by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a shift by ID' })
  remove(@Param('id') id: string) {
    return this.shiftService.remove(id);
  }
}
