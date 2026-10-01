import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreateAllocationDto {
  /**
   * ID of the internal employee being allocated to the project.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsOptional()
  @IsString()
  userId?: string;

  /**
   * ID of the freelancer being allocated to the project.
   * @example "3f1d2a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b"
   */
  @IsOptional()
  @IsString()
  freelancerId?: string;

  /**
   * Type of resource being allocated (internal user or freelancer).
   * @example "USER"
   */
  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType;

  /**
   * ID of the project the resource is being allocated to.
   * @example "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
   */
  @IsString()
  @IsNotEmpty()
  projectId: string;

  /**
   * Role the resource plays on the project.
   * @example "Backend Developer"
   */
  @IsString()
  @IsOptional()
  projectRole?: string;

  /**
   * Date the allocation begins.
   * @example "2026-07-15"
   */
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  /**
   * Date the allocation ends.
   * @example "2026-09-30"
   */
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
