import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class AssignAssetDto {
  /**
   * Identifier of the user the asset is being formally allocated to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  allocatedToId?: string;

  /**
   * Identifier of the user who will currently use the asset.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  currentlyUsedById?: string;

  /**
   * Identifier of the physical location the asset is being moved to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  locationId?: string;

  /**
   * Updated lifecycle status of the asset after assignment.
   * @example "ALLOCATED"
   */
  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

  /**
   * Free-form notes or remarks about the assignment.
   * @example "Handed over for the onsite client project"
   */
  @IsString()
  @IsOptional()
  notes?: string;
}
