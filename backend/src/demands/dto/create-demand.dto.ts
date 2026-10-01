import { IsString, IsOptional, IsDateString, IsNumber, IsEnum, IsUrl } from 'class-validator';
import { DemandPriority } from '@prisma/client';

export class CreateDemandDto {
  /**
   * The short, descriptive title of the demand.
   * @example "New customer onboarding portal"
   */
  @IsString()
  title: string;

  /**
   * A detailed description of what the demand entails.
   * @example "Build a self-service portal for onboarding new enterprise customers."
   */
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * The ID of the department that owns or requested this demand.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsOptional()
  @IsString()
  departmentId?: string;

  /**
   * The estimated target date by which the demand should be delivered.
   * @example "2026-09-30"
   */
  @IsOptional()
  @IsDateString()
  estimatedTimeline?: string;

  /**
   * The estimated budget for fulfilling the demand, in currency units.
   * @example 50000
   */
  @IsOptional()
  @IsNumber()
  estimatedBudget?: number;

  /**
   * The priority level of the demand.
   * @example "HIGH"
   */
  @IsOptional()
  @IsEnum(DemandPriority)
  priority?: DemandPriority;

  /**
   * A URL pointing to a supporting attachment for the demand.
   * @example "https://files.example.com/demands/spec.pdf"
   */
  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;
}
