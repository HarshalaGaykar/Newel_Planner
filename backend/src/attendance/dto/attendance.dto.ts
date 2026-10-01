import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CheckInDto {
  /**
   * Optional free-text note the employee adds when checking in.
   * @example "Starting early to cover the client call"
   */
  @IsString()
  @IsOptional()
  remarks?: string;

  /**
   * Whether the check-in is for a work-from-home day.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isWfh?: boolean;

  /**
   * IANA time zone used to interpret the check-in timestamp.
   * @example "Asia/Kolkata"
   */
  @IsString()
  @IsOptional()
  timeZone?: string;
}

export class CheckOutDto {
  /**
   * Optional free-text note the employee adds when checking out.
   * @example "Wrapped up the sprint tasks"
   */
  @IsString()
  @IsOptional()
  remarks?: string;

  /**
   * IANA time zone used to interpret the check-out timestamp.
   * @example "Asia/Kolkata"
   */
  @IsString()
  @IsOptional()
  timeZone?: string;
}

export class AttendanceFilterDto {
  /**
   * Start of the date range to filter attendance records (inclusive).
   * @example "2026-07-01"
   */
  @IsDateString()
  @IsOptional()
  startDate?: string;

  /**
   * End of the date range to filter attendance records (inclusive).
   * @example "2026-07-31"
   */
  @IsDateString()
  @IsOptional()
  endDate?: string;

  /**
   * Restrict results to a specific user's attendance records.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  userId?: string;

  /**
   * IANA time zone used to render attendance timestamps.
   * @example "Asia/Kolkata"
   */
  @IsString()
  @IsOptional()
  timeZone?: string;
}

export enum RegularizationReason {
  FORGOT_PUNCH = 'FORGOT_PUNCH',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  FIELD_WORK = 'FIELD_WORK',
  CLIENT_VISIT = 'CLIENT_VISIT',
  TRAINING = 'TRAINING',
  OTHER = 'OTHER',
}

export class CreateRegularizationDto {
  /**
   * Calendar date the regularization request applies to.
   * @example "2026-07-15"
   */
  @IsDateString()
  date: string;

  /**
   * Optional ID of the existing attendance record being corrected.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsOptional()
  attendanceId?: string;

  /**
   * Corrected check-in timestamp requested by the employee.
   * @example "2026-07-15T09:00:00Z"
   */
  @IsDateString()
  @IsOptional()
  requestedIn?: string;

  /**
   * Corrected check-out timestamp requested by the employee.
   * @example "2026-07-15T18:00:00Z"
   */
  @IsDateString()
  @IsOptional()
  requestedOut?: string;

  /**
   * Business reason justifying the regularization request.
   * @example "FORGOT_PUNCH"
   */
  @IsEnum(RegularizationReason)
  reason: RegularizationReason;

  /**
   * Optional additional explanation for the regularization request.
   * @example "Forgot to punch out after the client meeting"
   */
  @IsString()
  @IsOptional()
  remarks?: string;

  /**
   * IANA time zone used to interpret the requested timestamps.
   * @example "Asia/Kolkata"
   */
  @IsString()
  @IsOptional()
  timeZone?: string;
}

export class RegularizationFilterDto {
  /**
   * Restrict results to a specific user's regularization requests.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsOptional()
  userId?: string;

  /**
   * Start of the date range to filter regularization requests (inclusive).
   * @example "2026-07-01"
   */
  @IsDateString()
  @IsOptional()
  startDate?: string;

  /**
   * End of the date range to filter regularization requests (inclusive).
   * @example "2026-07-31"
   */
  @IsDateString()
  @IsOptional()
  endDate?: string;

  /**
   * IANA time zone used to render request timestamps.
   * @example "Asia/Kolkata"
   */
  @IsString()
  @IsOptional()
  timeZone?: string;
}

export class DailySummaryDto {
  /**
   * Calendar date to generate the daily attendance summary for.
   * @example "2026-07-15"
   */
  @IsDateString()
  date: string;

  /**
   * Restrict the summary to a specific user.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsOptional()
  userId?: string;

  /**
   * IANA time zone used to compute the daily summary boundaries.
   * @example "Asia/Kolkata"
   */
  @IsString()
  @IsOptional()
  timeZone?: string;
}

export class RegularizationDecisionDto {
  /**
   * Approver's note on the decision, included in the email sent back to the
   * requester. Especially useful on rejection, where "rejected" alone tells the
   * employee nothing.
   * @example "Client visit confirmed with the PM."
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  remarks?: string;
}
