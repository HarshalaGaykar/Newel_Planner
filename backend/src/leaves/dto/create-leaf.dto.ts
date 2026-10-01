import { IsNotEmpty, IsString, IsDateString, IsBoolean, IsOptional, IsIn } from 'class-validator';

export class CreateLeafDto {
  /**
   * The ID of the user the leave request belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsNotEmpty()
  userId: string;

  /**
   * The first day of the leave period (inclusive).
   * @example "2026-07-15"
   */
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  /**
   * The last day of the leave period (inclusive).
   * @example "2026-07-17"
   */
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  /**
   * The code identifying the type of leave being applied for.
   * @example "CL"
   */
  @IsString()
  @IsNotEmpty()
  leaveTypeCode: string;

  /**
   * Whether the request is for a half day rather than a full day.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean;

  /**
   * The half-day session requested when the leave is a half day.
   * @example "MORNING"
   */
  @IsString()
  @IsIn(['MORNING', 'AFTERNOON'])
  @IsOptional()
  halfDaySession?: string;

  /**
   * An optional free-text reason describing why the leave is requested.
   * @example "Family function out of town"
   */
  @IsString()
  @IsOptional()
  reason?: string;
}
