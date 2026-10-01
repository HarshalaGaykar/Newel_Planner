import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { PublicHolidaysService } from './public-holidays.service';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { BulkUploadPublicHolidayDto } from './dto/bulk-upload-public-holiday.dto';

@ApiTags('Public Holidays')
@ApiBearerAuth()
@Controller({ path: 'public-holidays', version: '1' })
@UseGuards(JwtAuthGuard)
export class PublicHolidaysController {
  constructor(private service: PublicHolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of public holidays, optionally filtered by year' })
  findAll(@Query('year') year?: string) {
    return this.service.findAll(year ? parseInt(year) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single public holiday by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new public holiday' })
  create(@Body() dto: CreatePublicHolidayDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update an existing public holiday by ID' })
  update(@Param('id') id: string, @Body() dto: UpdatePublicHolidayDto) {
    return this.service.update(id, dto);
  }

  @Post('bulk-upload')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Bulk upload multiple public holidays in a single request' })
  bulkUpload(@Body() dto: BulkUploadPublicHolidayDto) {
    return this.service.bulkUpload(dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a public holiday by ID' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
