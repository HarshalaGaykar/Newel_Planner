import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class MonthlyEffortsQueryDto {
  /**
   * Cumulative cutoff date — the report sums every hour logged on or before
   * this date, grouped by project. Defaults to the end of the current month.
   * @example "2026-08-31"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  /**
   * One-based page number to retrieve from the paginated result set.
   * @example 1
   */
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  /**
   * Maximum number of project rows to return per page (capped at 100).
   * @example 25
   */
  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 25;
}
