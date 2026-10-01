import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TimesheetStatus } from '@prisma/client';

export class QueryTeamSummaryDto {
  /**
   * Restricts the summary to a single team member. The requested user must fall
   * within the caller's data scope, otherwise the request is rejected.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @ApiPropertyOptional({ description: 'Filter by a single team member' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * Keeps only team members who have at least one timesheet in this status.
   * @example "SUBMITTED"
   */
  @ApiPropertyOptional({ enum: TimesheetStatus, description: 'Keep members having at least one timesheet in this status' })
  @IsOptional()
  @IsEnum(TimesheetStatus)
  status?: TimesheetStatus;

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
   * Number of member cards to return per page.
   * @example 6
   */
  @ApiPropertyOptional({ default: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 6;
}
