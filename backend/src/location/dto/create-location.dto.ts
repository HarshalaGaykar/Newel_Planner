import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateLocationDto {
  /**
   * The display name of the location or office site.
   * @example "Headquarters"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * The city where the location is situated.
   * @example "Mumbai"
   */
  @IsString()
  @IsOptional()
  city?: string;

  /**
   * The country where the location is situated.
   * @example "India"
   */
  @IsString()
  @IsOptional()
  country?: string;

  /**
   * The IANA timezone identifier for the location.
   * @example "Asia/Kolkata"
   */
  @IsString()
  @IsOptional()
  timezone?: string;

  /**
   * The unique identifier of the company this location belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsOptional()
  companyId?: string;

  /**
   * Whether the location is currently active and available for use.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
