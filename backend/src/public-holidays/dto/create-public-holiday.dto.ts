import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePublicHolidayDto {
  /**
   * The display name of the public holiday.
   * @example "Independence Day"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * The calendar date on which the holiday falls, in ISO format.
   * @example "2026-08-15"
   */
  @IsDateString()
  @IsNotEmpty()
  date: string;

  /**
   * Whether the holiday applies to all locations globally rather than a specific location.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean;

  /**
   * The category or type of the holiday (e.g. national, regional, religious).
   * @example "National"
   */
  @IsString()
  @IsOptional()
  type?: string;

  /**
   * A short description providing additional context about the holiday.
   * @example "National holiday commemorating independence"
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Whether the holiday is optional and left to the employee's discretion.
   * @example false
   */
  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  /**
   * The identifier of the location this holiday is associated with, when not global.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  locationId?: string;
}
