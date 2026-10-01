import { IsUUID, IsNumber, IsDateString, IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class CreateMaturityDto {
  /**
   * The unique identifier of the employee this maturity record belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  userId: string;

  /**
   * The employee's current maturity score for the specified month.
   * @example 60
   */
  @IsNumber()
  currentMaturityValue: number;

  /**
   * The month this maturity record applies to, as an ISO date string.
   * @example "2026-07-01"
   */
  @IsDateString()
  forTheMonth: string;

  /**
   * Optional free-text remarks explaining or justifying the maturity value.
   * @example "Consistent delivery and strong ownership this month."
   */
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  remarks?: string;

  /**
   * Whether this maturity record is currently active.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
