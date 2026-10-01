import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * Backs the attendance-compliance report — employees who, on a given working
 * day, have no check-in, no full-day leave and no timesheet entry.
 *
 * Every field is optional: the defaults describe "today, every active
 * employee", which is the report's baseline. Range resolution (defaulting,
 * future clamping, and the maximum span) happens server-side in
 * `resolveNonComplianceRange`, not here, so the same rules apply no matter
 * which client calls it.
 */
export class NonComplianceQueryDto {
  /**
   * First calendar day to report on, as `YYYY-MM-DD`. Defaults to today.
   * Given without `endDate`, it means that single day.
   * @example "2026-09-30"
   */
  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * Last calendar day to report on, as `YYYY-MM-DD`. Defaults to `startDate`
   * (or today). A value after today is clamped to today — a future day cannot
   * be non-compliant. At most 93 days may be requested at once.
   * @example "2026-09-30"
   */
  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /**
   * Restrict to employees in a single department.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /**
   * Free-text match against the employee's first name, last name or employee
   * code. Case-insensitive substring match.
   * @example "sharma"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userName?: string;

  /**
   * Narrow to a single employee.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * Also evaluate Saturdays and Sundays. Off by default: without it, every
   * employee who does not work weekends is flagged on all of them.
   * @example false
   */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  includeWeekends?: boolean = false;

  /**
   * Also evaluate non-optional public holidays. Off by default.
   * @example false
   */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  includeHolidays?: boolean = false;

  /**
   * Treat a leave request that is still PENDING as leave applied. On by
   * default: the employee did apply, which is what this report is auditing.
   * Turn it off to flag only days covered by an already-approved leave.
   * @example true
   */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  includePendingLeave?: boolean = true;

  /**
   * One-based page number.
   * @example 1
   */
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Rows per page (capped at 100).
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
   * IANA time zone used to resolve calendar-day boundaries — which day a
   * check-in, leave or timesheet entry belongs to, and what "today" means when
   * no dates are given. Defaults to UTC; pass the viewer's browser time zone
   * for an accurate report.
   * @example "Asia/Kolkata"
   */
  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timeZone?: string;
}
