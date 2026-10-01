import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AdminConfigService } from './admin-config.service';
import { NumberSeriesService } from './number-series.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission } from '../auth/constants/rbac.constants';
import { PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  UpsertConfigDto,
  UpdateNumberSeriesDto,
  LockPeriodDto,
  FinancialYearDto,
} from './dto/admin-config.dto';

@ApiTags('Admin Config')
@ApiBearerAuth()
@Controller('admin-config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminConfigController {
  constructor(
    private readonly configService: AdminConfigService,
    private readonly seriesService: NumberSeriesService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Configs ──────────────────────────────────────────────────────────────────

  @Get()
  @Permissions(Permission.ADMIN_CONFIG_VIEW)
  @ApiOperation({ summary: 'Get all admin configuration entries organized by group' })
  async getAllConfigs() {
    return this.configService.getAllByGroup();
  }

  @Get('group/:group')
  @Permissions(Permission.ADMIN_CONFIG_VIEW)
  @ApiOperation({ summary: 'Get all configuration entries for a specific group' })
  async getByGroup(@Param('group') group: string) {
    return this.configService.getGroup(group);
  }

  // Keys any authenticated user may read (no ADMIN_CONFIG_VIEW required)
  private static readonly PUBLIC_KEYS = ['timesheet.backdated_days_limit'];

  @Get('public')
  @ApiOperation({ summary: 'Get publicly readable configuration keys available to any authenticated user' })
  async getPublicConfigs() {
    const rows = await this.prisma.adminConfig.findMany({
      where: { key: { in: AdminConfigController.PUBLIC_KEYS } },
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  @Put(':key')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Create or update a configuration entry by key' })
  async updateConfig(
    @Param('key') key: string,
    @Body() dto: UpsertConfigDto,
    @Request() req: any,
  ) {
    return this.configService.set(key, dto, req.user.id);
  }

  // ── Number Series ────────────────────────────────────────────────────────────

  @Get('number-series')
  @Permissions(Permission.ADMIN_CONFIG_VIEW)
  @ApiOperation({ summary: 'Get all number series configurations' })
  async getNumberSeries() {
    return this.seriesService.getAllSeries();
  }

  @Put('number-series/:module')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Update the number series configuration for a module' })
  async updateNumberSeries(
    @Param('module') module: string,
    @Body() dto: UpdateNumberSeriesDto,
  ) {
    return this.seriesService.updateSeries(module, dto);
  }

  // ── Timesheet Locks ──────────────────────────────────────────────────────────

  @Get('lock-periods')
  @Permissions(Permission.ADMIN_CONFIG_VIEW)
  @ApiOperation({ summary: 'Get all timesheet lock periods' })
  async getLockPeriods() {
    return this.prisma.timesheetLockPeriod.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        lockedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  @Post('lock-periods')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Lock a timesheet period for a given month and year' })
  async lockPeriod(@Body() dto: LockPeriodDto, @Request() req: any) {
    return this.prisma.timesheetLockPeriod.upsert({
      where: {
        month_year: { month: dto.month, year: dto.year },
      },
      create: {
        month: dto.month,
        year: dto.year,
        isLocked: true,
        lockedById: req.user.id,
      },
      update: {
        isLocked: true,
        lockedById: req.user.id,
      },
    });
  }

  @Delete('lock-periods/:id')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Unlock a timesheet lock period by ID' })
  async unlockPeriod(@Param('id') id: string) {
    return this.prisma.timesheetLockPeriod.delete({
      where: { id },
    });
  }

  // ── Financial Years ──────────────────────────────────────────────────────────

  @Get('financial-years')
  @Permissions(Permission.ADMIN_CONFIG_VIEW)
  @ApiOperation({ summary: 'Get all financial years' })
  async getFinancialYears() {
    return this.prisma.financialYear.findMany({
      orderBy: { startYear: 'desc' },
    });
  }

  @Post('financial-years')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Create a new financial year' })
  async createFinancialYear(@Body() dto: FinancialYearDto) {
    return this.prisma.financialYear.create({
      data: dto,
    });
  }

  @Delete('financial-years/:id')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Delete a financial year by ID' })
  async deleteFinancialYear(@Param('id') id: string) {
    return await this.prisma.financialYear.delete({
      where: { id },
    });
  }

  @Patch('financial-years/:id/set-current')
  @Permissions(Permission.ADMIN_CONFIG_EDIT)
  @ApiOperation({ summary: 'Set a financial year as the current active year' })
  async setCurrentFinancialYear(@Param('id') id: string) {
    return await this.prisma.$transaction(async (tx) => {
      await tx.financialYear.updateMany({
        data: { isCurrent: false },
      });
      return tx.financialYear.update({
        where: { id },
        data: { isCurrent: true },
      });
    });
  }
}
