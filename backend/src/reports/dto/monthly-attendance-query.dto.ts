import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// Backs the monthly attendance register — one row per employee per calendar
// day of the selected month (check-in time or blank if absent/no record).
// Month/year default server-side to the current month, like getAttendanceReport;
// every other field is an optional narrowing filter.
export class MonthlyAttendanceQueryDto {
  /**
   * One-based calendar month to report on. Defaults to the current month.
   * @example 8
   */
  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  /**
   * Calendar year to report on. Defaults to the current year.
   * @example 2026
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  year?: number;

  /**
   * Restrict to employees in a single department.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /**
   * Free-text match against the employee's first/last name. Case-insensitive,
   * substring match.
   * @example "sharma"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userName?: string;

  /**
   * Restrict to active employees (`true`), inactive employees (`false`), or
   * omit for both.
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
   * One-based page number to retrieve from the paginated result set.
   * @example 1
   */
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Maximum number of rows to return per page (capped at 100).
   * @example 25
   */
  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  /**
   * IANA time zone used to resolve calendar-day boundaries (which day a
   * check-in belongs to, and the default month when `month`/`year` are
   * omitted). Defaults to UTC when not provided — pass the viewer's browser
   * time zone for an accurate register.
   * @example "Asia/Kolkata"
   */
  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timeZone?: string;
}
