import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsArray } from 'class-validator';
import { CRType } from '@prisma/client';

export class CreateChangeRequestDto {
  /**
   * The ID of the project this change request belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsNotEmpty()
  projectId: string;

  /**
   * A short, descriptive title summarizing the change request.
   * @example "Extend timeline for phase 2 delivery"
   */
  @IsString()
  @IsNotEmpty()
  title: string;

  /**
   * The category of change being requested.
   * @example "TIMELINE"
   */
  @IsEnum(CRType)
  type: CRType;

  /**
   * A detailed explanation of the requested change and its rationale.
   * @example "Client requested additional reporting features that extend the delivery timeline."
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * The area or deliverables of the project impacted by this change.
   * @example "Reporting module and dashboard exports"
   */
  @IsString()
  @IsOptional()
  impactedScope?: string;

  /**
   * The change in project budget introduced by this request, in currency units.
   * @example 5000
   */
  @IsNumber()
  @IsOptional()
  budgetDelta?: number;

  /**
   * The change in project timeline introduced by this request, in days.
   * @example 14
   */
  @IsNumber()
  @IsOptional()
  timelineDeltaDays?: number;

  /**
   * A list of resource allocation changes associated with this request.
   * @example [{ "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "action": "ADD" }]
   */
  @IsArray()
  @IsOptional()
  resourceChanges?: any[];
}
