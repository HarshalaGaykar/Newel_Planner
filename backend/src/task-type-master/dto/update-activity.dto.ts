import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateActivityDto {
  /**
   * Updated display name of the activity.
   * @example "Requirement Analysis"
   */
  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  /**
   * Whether the activity is active and available for selection.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
