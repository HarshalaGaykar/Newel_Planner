import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateCompanyDto {
  /**
   * The legal or trading name of the company.
   * @example "Newel Technologies Pvt Ltd"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * The company's GST identification number for tax purposes.
   * @example "27AABCU9603R1ZM"
   */
  @IsString()
  @IsOptional()
  gstin?: string;

  /**
   * The company's Permanent Account Number (PAN).
   * @example "AABCU9603R"
   */
  @IsString()
  @IsOptional()
  pan?: string;

  /**
   * The registered postal address of the company.
   * @example "5th Floor, Tower B, Baner Road, Pune 411045"
   */
  @IsString()
  @IsOptional()
  address?: string;

  /**
   * The identifier of the default currency used by the company.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsOptional()
  currencyId?: string;

  /**
   * Whether the company is currently active and available for use.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
