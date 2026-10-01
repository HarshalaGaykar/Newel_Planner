import {
  IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean,
  IsInt, IsArray, Min, Matches,
} from 'class-validator';

export class CreateShiftDto {
  /**
   * The display name of the shift.
   * @example "Morning Shift"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * The time the shift begins, in 24-hour HH:mm format.
   * @example "09:00"
   */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  /**
   * The time the shift ends, in 24-hour HH:mm format.
   * @example "18:00"
   */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  /**
   * The total unpaid break duration within the shift, in minutes.
   * @example 60
   */
  @IsInt()
  @Min(0)
  @IsOptional()
  breakMinutes?: number;

  /**
   * The days of the week on which this shift is active.
   * @example ["MON", "TUE", "WED", "THU", "FRI"]
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  weekdays?: string[];

  /**
   * The identifier of the location this shift is associated with.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsOptional()
  locationId?: string;

  /**
   * Whether this shift is the default shift for new assignments.
   * @example false
   */
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  /**
   * Whether this shift is currently active and available for use.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
