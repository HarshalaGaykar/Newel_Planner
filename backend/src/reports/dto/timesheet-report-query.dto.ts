import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto';

// Same date/project/user/status filters as ReportFiltersDto, plus the page/limit
// pair used only by the paginated timesheet report table (mirrors QueryAuditLogDto).
export class TimesheetReportQueryDto extends ReportFiltersDto {
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
   * Maximum number of entries to return per page (capped at 100).
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
