import { Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';
import { AssetConfirmationsService } from './asset-confirmations.service';
import { AssetAllocationConfirmationCron } from './asset-allocation-confirmation.cron';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Asset Confirmations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('asset-confirmations')
export class AssetConfirmationsController {
  constructor(
    private readonly service: AssetConfirmationsService,
    private readonly cron: AssetAllocationConfirmationCron,
  ) {}

  @Get('current')
  @ApiOperation({ summary: "Get the current month's asset-allocation confirmation status and team assets for the logged-in manager" })
  getCurrent(@Request() req: any, @Query('timeZone') timeZone?: string) {
    return this.service.getCurrentForUser(req.user.userId, timeZone);
  }

  @Post('confirm')
  @ApiOperation({ summary: "Confirm the current month's team asset allocations for the logged-in manager" })
  confirm(@Request() req: any, @Query('timeZone') timeZone?: string) {
    return this.service.confirmCurrent(req.user.userId, timeZone);
  }

  @Post('run')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Manually trigger the asset-confirmation job (ADMIN only). Optional ?stage=initial|r5|r7|r10 and ?date=YYYY-MM-DD; bypasses the enabled toggle.',
  })
  run(
    @Query('stage') stage?: 'initial' | 'r5' | 'r7' | 'r10',
    @Query('date') date?: string,
  ) {
    return this.cron.run({ stage, date, manual: true });
  }
}
