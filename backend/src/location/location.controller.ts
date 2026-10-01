import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Locations')
@ApiBearerAuth()
@Controller({ path: 'locations', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Get()
  @ApiOperation({ summary: 'Get a list of all locations' })
  findAll() {
    return this.locationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single location by ID' })
  findOne(@Param('id') id: string) {
    return this.locationService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new location' })
  create(@Body() dto: CreateLocationDto) {
    return this.locationService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing location by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a location by ID' })
  remove(@Param('id') id: string) {
    return this.locationService.remove(id);
  }
}
