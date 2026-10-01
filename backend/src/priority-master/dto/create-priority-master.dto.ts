import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class CreatePriorityMasterDto {
  /**
   * The display name of the priority level.
   * @example "High"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * The hex color code used to visually represent this priority in the UI.
   * @example "#FF5733"
   */
  @IsString()
  @IsOptional()
  color?: string;

  /**
   * The position used to order priority levels when listed.
   * @example 1
   */
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  /**
   * Whether this priority level is currently active and selectable.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
