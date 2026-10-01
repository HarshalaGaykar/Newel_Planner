import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto';

// Every field here is optional by design — this backs the dynamic
// timesheet-entries report, where an empty query returns the full (paginated)
// dataset and each additional field narrows it further.
export class TimesheetEntriesQueryDto extends ReportFiltersDto {
  /**
   * Free-text match against the resource's first/last name (employees) or
   * full name (freelancers). Case-insensitive, substring match.
   * @example "sharma"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userName?: string;

  /**
   * Free-text match against the project name. Case-insensitive, substring
   * match. Use alongside/instead of `projectId` (exact match).
   * @example "newel"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectName?: string;

  /**
   * Restrict to active employees (`true`), inactive employees (`false`), or
   * omit for both — freelancer entries are unaffected by this filter either
   * way, since freelancers don't carry an active/inactive flag.
   * @example true
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  /**
   * Lower bound (inclusive) on hours logged for a single entry.
   * @example 1
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  minHours?: number;

  /**
   * Upper bound (inclusive) on hours logged for a single entry.
   * @example 8
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  maxHours?: number;

  /**
   * Lower bound (inclusive) on the entry's planned effort
   * (`task.plannedHours`, falling back to `task.estimatedEffort`).
   * @example 1
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  minPlannedEffort?: number;

  /**
   * Upper bound (inclusive) on the entry's planned effort
   * (`task.plannedHours`, falling back to `task.estimatedEffort`).
   * @example 8
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  maxPlannedEffort?: number;

  /**
   * Start of the range (inclusive) on when the entry was created —
   * distinct from `startDate`/`endDate`, which filter the timesheet date.
   * @example "2026-08-01"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  /**
   * End of the range (inclusive) on when the entry was created.
   * @example "2026-08-31"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdTo?: string;

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
