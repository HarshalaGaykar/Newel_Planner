import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { AssetType, AssetStatus } from '@prisma/client';

export class CreateAssetDto {
  /**
   * Unique human-readable identifier tag printed on or attached to the asset.
   * @example "LPT-001"
   */
  @IsString()
  assetTag: string;

  /**
   * Descriptive name of the asset.
   * @example "MacBook Pro 16"
   */
  @IsString()
  name: string;

  /**
   * Category of the asset.
   * @example "HARDWARE"
   */
  @IsEnum(AssetType)
  type: AssetType;

  /**
   * Current lifecycle status of the asset.
   * @example "AVAILABLE"
   */
  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

  /**
   * Manufacturer serial number of the asset.
   * @example "C02X1234JGH7"
   */
  @IsString()
  @IsOptional()
  serialNumber?: string;

  /**
   * Vendor or supplier the asset was purchased from.
   * @example "Apple Inc."
   */
  @IsString()
  @IsOptional()
  vendor?: string;

  /**
   * Date the asset was purchased.
   * @example "2026-01-15"
   */
  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  /**
   * Date the asset's warranty expires.
   * @example "2029-01-15"
   */
  @IsDateString()
  @IsOptional()
  warrantyExpiry?: string;

  /**
   * Whether the asset was provided by the client rather than owned internally.
   * @example false
   */
  @IsBoolean()
  @IsOptional()
  isClientProvided?: boolean;

  /**
   * Identifier of the client that owns or provided the asset.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  clientId?: string;

  /**
   * Identifier of the physical location where the asset is stored.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  locationId?: string;

  /**
   * Identifier of the user the asset is formally allocated to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  allocatedToId?: string;

  /**
   * Identifier of the user currently using the asset.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  currentlyUsedById?: string;

  /**
   * Identifier of the client-side spokesperson associated with this asset.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  spokespersonId?: string;

  /**
   * Identifier of the project this asset is associated with.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  projectId?: string;

  /**
   * Free-form notes or remarks about the asset.
   * @example "Screen has a minor scratch on the bottom-left corner"
   */
  @IsString()
  @IsOptional()
  notes?: string;
}
