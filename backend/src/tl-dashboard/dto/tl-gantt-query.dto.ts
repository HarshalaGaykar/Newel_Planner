import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const SCOPES = ['ME', 'MEMBER', 'TEAM'] as const;
export type TlGanttScope = (typeof SCOPES)[number];

const WITHIN_ESTIMATE_VALUES = ['WITHIN', 'OVER', 'UNESTIMATED'] as const;
export type WithinEstimate = (typeof WITHIN_ESTIMATE_VALUES)[number];

const SORT_FIELDS = ['endDate', 'estimate', 'logged', 'variance'] as const;
export type TlGanttSortField = (typeof SORT_FIELDS)[number];

const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export class TlGanttQueryDto {
  /**
   * Whose tasks to show. TEAM = all direct reports; MEMBER = one specific
   * direct report (requires `memberId`); ME = the TL's own tasks (default).
   * @example "ME"
   */
  @ApiPropertyOptional({ enum: SCOPES, default: 'ME' })
  @IsOptional()
  @IsEnum(SCOPES)
  scope?: TlGanttScope = 'ME';

  /**
   * Required when `scope=MEMBER`. Must be one of the caller's direct reports —
   * requests for anyone else are rejected.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /**
   * Raw Task.status value (BACKLOG | TODO | WIP | QA | COMPLETED) — not
   * validated against a DB enum since the column itself is a plain string.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: WITHIN_ESTIMATE_VALUES })
  @IsOptional()
  @IsEnum(WITHIN_ESTIMATE_VALUES)
  withinEstimate?: WithinEstimate;

  /** Visible date-range filter for this Gantt — independent of the dashboard's Daily/Weekly/Monthly/Yearly tabs. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'endDate' })
  @IsOptional()
  @IsEnum(SORT_FIELDS)
  sortBy?: TlGanttSortField = 'endDate';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'asc' })
  @IsOptional()
  @IsEnum(SORT_DIRECTIONS)
  sortDir?: SortDirection = 'asc';
}
