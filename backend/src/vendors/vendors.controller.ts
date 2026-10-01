import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { CreateVendorContactDto } from './dto/create-vendor-contact.dto';
import { VendorCategory, VendorStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  create(@Body() createVendorDto: CreateVendorDto) {
    return this.vendorsService.create(createVendorDto);
  }

  @Get()
  findAll(
    @Query('category') category?: VendorCategory,
    @Query('status') status?: VendorStatus,
  ) {
    return this.vendorsService.findAll({ category, status });
  }

  @Get('expiring')
  findExpiring() {
    return this.vendorsService.findExpiring();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorsService.update(id, updateVendorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vendorsService.remove(id);
  }

  @Post(':id/contacts')
  addContact(@Param('id') id: string, @Body() createContactDto: CreateVendorContactDto) {
    return this.vendorsService.addContact(id, createContactDto);
  }

  @Delete(':id/contacts/:contactId')
  removeContact(@Param('contactId') contactId: string) {
    return this.vendorsService.removeContact(contactId);
  }
}
