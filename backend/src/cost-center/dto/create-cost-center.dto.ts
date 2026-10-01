import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean, Matches } from 'class-validator';

export class CreateCostCenterDto {
  /**
   * Unique uppercase alphanumeric code identifying the cost center.
   * @example "CC1001"
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/, { message: 'code must be uppercase alphanumeric' })
  code: string;

  /**
   * Human-readable display name of the cost center.
   * @example "Engineering Operations"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Optional ID of the department this cost center belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  /**
   * Whether the cost center is currently active and available for use.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
