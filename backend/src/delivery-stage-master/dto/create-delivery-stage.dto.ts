import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Min, MaxLength } from 'class-validator';

export class CreateDeliveryStageDto {
  /**
   * Display name of the delivery lifecycle stage. Unique.
   * @example "UAT Sign-off"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /**
   * Position used to order stages in the dropdown. Lower sorts first.
   * @example 17
   */
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  /**
   * Whether the stage is selectable. Inactive stages stay on existing items but
   * are hidden from the dropdown.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
