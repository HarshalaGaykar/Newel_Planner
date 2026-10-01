import { IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';

export class ReportFiltersDto {
  /**
   * Start of the date range to include in the report (inclusive).
   * @example "2026-07-01"
   */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * End of the date range to include in the report (inclusive).
   * @example "2026-07-31"
   */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /**
   * Restrict the report to a single project by its unique identifier.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /**
   * Restrict the report to a single user by their unique identifier.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * Filter results by an entity status value.
   * @example "WIP"
   */
  @IsOptional()
  @IsString()
  status?: string;
}
