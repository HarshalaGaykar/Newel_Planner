import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientContactDto } from './client-contact.dto';

export class CreateClientDto {
  /**
   * Legal or trading name of the client organization.
   * @example "Acme Interiors Pvt Ltd"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * GST identification number of the client for tax invoicing.
   * @example "27ABCDE1234F1Z5"
   */
  @IsString()
  @IsOptional()
  gstin?: string;

  /**
   * Permanent Account Number of the client for tax reporting.
   * @example "ABCDE1234F"
   */
  @IsString()
  @IsOptional()
  pan?: string;

  /**
   * Primary contact email address for the client.
   * @example "accounts@acmeinteriors.com"
   */
  @IsString()
  @IsOptional()
  email?: string;

  /**
   * Primary contact phone number for the client.
   * @example "+91 9876543210"
   */
  @IsString()
  @IsOptional()
  phone?: string;

  /**
   * Postal or billing address of the client.
   * @example "42 MG Road, Bengaluru, Karnataka 560001"
   */
  @IsString()
  @IsOptional()
  address?: string;

  /**
   * Name of the primary point of contact at the client organization.
   * @example "Priya Sharma"
   */
  @IsString()
  @IsOptional()
  contactPerson?: string;

  /**
   * Identifier of the currency used for billing this client.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  currencyId?: string;

  /**
   * Whether the client is currently active and available for new projects.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /**
   * Named contacts for this client, each with their own email address.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientContactDto)
  @IsOptional()
  contacts?: ClientContactDto[];
}
