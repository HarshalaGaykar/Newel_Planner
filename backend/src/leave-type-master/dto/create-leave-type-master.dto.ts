import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Min,
} from 'class-validator';

export class CreateLeaveTypeMasterDto {
  /**
   * Short unique code identifying the leave type.
   * @example "CL"
   */
  @IsString()
  @IsNotEmpty()
  code: string;

  /**
   * Human-readable display name of the leave type.
   * @example "Casual Leave"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Whether this leave type is paid.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  /**
   * Whether employees can apply for a half day of this leave type.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  allowHalfDay?: boolean;

  /**
   * Maximum number of leave days that can be carried forward to the next period.
   * @example 5
   */
  @IsInt()
  @Min(0)
  @IsOptional()
  carryForwardMax?: number;

  /**
   * Number of months after which accrued leave of this type expires.
   * @example 12
   */
  @IsInt()
  @Min(1)
  @IsOptional()
  expiryMonths?: number;

  /**
   * Whether applying for this leave type requires manager approval.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  /**
   * Whether the sandwich-leave rule (counting intervening holidays) applies to this leave type.
   * @example false
   */
  @IsBoolean()
  @IsOptional()
  requiresSandwichCheck?: boolean;

  /**
   * Whether this leave type is currently active and available for selection.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
