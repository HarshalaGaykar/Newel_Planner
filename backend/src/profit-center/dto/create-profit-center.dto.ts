import { IsString, IsNotEmpty, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateProfitCenterDto {
  /**
   * Unique uppercase alphanumeric code identifying the profit center.
   * @example "PC001"
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/, { message: 'code must be uppercase alphanumeric' })
  code: string;

  /**
   * Human-readable display name of the profit center.
   * @example "North America Operations"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Whether the profit center is currently active and usable.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
