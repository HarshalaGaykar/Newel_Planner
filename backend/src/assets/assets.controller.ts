import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AssetsService } from './assets.service';
import { ExportService } from '../reports/export.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssetType, AssetStatus } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new asset' })
  create(@Body() createAssetDto: CreateAssetDto, @Request() req: any) {
    return this.assetsService.create(createAssetDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of assets with optional type, status, client, location, and user filters' })
  findAll(
    @Query('type') type?: AssetType,
    @Query('status') status?: AssetStatus,
    @Query('clientId') clientId?: string,
    @Query('locationId') locationId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.assetsService.findAll({ type, status, clientId, locationId, userId });
  }

  // NOTE: must be declared before the `:id` route so "export" is not matched as an id.
  @Get('export')
  @ApiOperation({ summary: 'Export assets to an .xlsx file (respects the same filters as the list)' })
  async export(
    @Res() res: Response,
    @Query('type') type?: AssetType,
    @Query('status') status?: AssetStatus,
    @Query('clientId') clientId?: string,
    @Query('locationId') locationId?: string,
    @Query('userId') userId?: string,
  ) {
    const assets = await this.assetsService.findAll({ type, status, clientId, locationId, userId });

    const fmtDate = (d: Date | string | null | undefined) =>
      d ? new Date(d).toISOString().split('T')[0] : '';
    const fullName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined) =>
      u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '' : '';

    const columns = [
      { header: 'Asset Tag', key: 'assetTag' },
      { header: 'Name', key: 'name' },
      { header: 'Type', key: 'type' },
      { header: 'Status', key: 'status' },
      { header: 'Serial Number', key: 'serialNumber' },
      { header: 'Vendor', key: 'vendor' },
      { header: 'Purchase Date', key: 'purchaseDate' },
      { header: 'Warranty Expiry', key: 'warrantyExpiry' },
      { header: 'Ownership', key: 'ownership' },
      { header: 'Location', key: 'location' },
      { header: 'Allocated To', key: 'allocatedTo' },
      { header: 'Currently Used By', key: 'currentlyUsedBy' },
      { header: 'Spokesperson', key: 'spokesperson' },
      { header: 'Project', key: 'project' },
      { header: 'Notes', key: 'notes' },
    ];

    const rows = assets.map((a: any) => ({
      assetTag: a.assetTag ?? '',
      name: a.name ?? '',
      type: a.type ?? '',
      status: a.status ?? '',
      serialNumber: a.serialNumber ?? '',
      vendor: a.vendor ?? '',
      purchaseDate: fmtDate(a.purchaseDate),
      warrantyExpiry: fmtDate(a.warrantyExpiry),
      ownership: a.isClientProvided ? (a.client?.name ? `Client: ${a.client.name}` : 'Client-provided') : 'Internal',
      location: a.location?.name ?? '',
      allocatedTo: fullName(a.allocatedTo),
      currentlyUsedBy: fullName(a.currentlyUsedBy),
      spokesperson: a.spokesperson?.name ?? '',
      project: a.project?.name ?? '',
      notes: a.notes ?? '',
    }));

    const buffer = await this.exportService.toExcel('Assets', columns, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="assets.xlsx"');
    return res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single asset by ID' })
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing asset by ID' })
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto, @Request() req: any) {
    return this.assetsService.update(id, updateAssetDto, req.user.userId);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign or reallocate an asset to a user or location' })
  assign(@Param('id') id: string, @Body() assignAssetDto: AssignAssetDto, @Request() req: any) {
    return this.assetsService.assign(id, assignAssetDto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an asset by ID' })
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
