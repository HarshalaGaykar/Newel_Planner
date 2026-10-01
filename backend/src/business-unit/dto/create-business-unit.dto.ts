import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateBusinessUnitDto {
  /**
   * The display name of the business unit.
   * @example "Interior Design"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * A short unique code identifying the business unit.
   * @example "INT-DSGN"
   */
  @IsString()
  @IsNotEmpty()
  code: string;

  /**
   * The unique identifier of the company this business unit belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  /**
   * Whether the business unit is currently active.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
