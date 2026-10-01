import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import type { DashboardPeriod } from '../../common/period-window.util';

const PERIODS: DashboardPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

export class TlStatsQueryDto {
  /**
   * The window used both for the stat cards' trend comparison (current vs.
   * the immediately preceding equal period) and returned as `windowStart`/
   * `windowEnd`. Live counts themselves are never period-filtered.
   * @example "WEEKLY"
   */
  @ApiPropertyOptional({ enum: PERIODS, default: 'WEEKLY' })
  @IsOptional()
  @IsEnum(PERIODS)
  period?: DashboardPeriod = 'WEEKLY';

  /**
   * IANA time zone the period windows are computed in (e.g. day/week/month
   * boundaries). Defaults to UTC when omitted.
   * @example "Asia/Kolkata"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeZone?: string;

  /**
   * Anchor date for the period windows — mainly for testability. Defaults to
   * the current moment.
   * @example "2026-09-08"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  referenceDate?: string;
}
