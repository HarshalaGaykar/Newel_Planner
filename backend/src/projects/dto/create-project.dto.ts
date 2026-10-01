import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsBoolean, IsNumber } from 'class-validator';
import { ProjectStatus, ProjectType } from '@prisma/client';

export class CreateProjectDto {
  /**
   * Display name of the project.
   * @example "Acme CRM Revamp"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Optional free-text summary of the project's scope and goals.
   * @example "Rebuild the Acme customer portal on the new platform."
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Project delivery type.
   * @example "TIME_AND_MATERIAL"
   */
  @IsEnum(ProjectType)
  @IsNotEmpty()
  type: ProjectType;

  /**
   * Project start date (ISO 8601).
   * @example "2026-07-15"
   */
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  /**
   * Planned project end date (ISO 8601).
   * @example "2026-12-31"
   */
  @IsDateString()
  @IsOptional()
  endDate?: string;

  /**
   * Current lifecycle status of the project.
   * @example "ACTIVE"
   */
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  /**
   * Human-readable project code / short identifier.
   * @example "ACME-2026"
   */
  @IsString()
  @IsOptional()
  projectCode?: string;

  /**
   * ID of the client this project belongs to.
   * @example "3f1a8c2e-9b4d-4e7a-8c1d-2f6b9a0e5d3c"
   */
  @IsString()
  @IsOptional()
  clientId?: string;

  /**
   * Whether this is an internal (non-billable) project.
   * @example false
   */
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  /**
   * Delivery methodology used for the project.
   * @example "AGILE"
   */
  @IsString()
  @IsOptional()
  methodology?: string;

  /**
   * User ID of the assigned Project Manager.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsOptional()
  pmId?: string;

  /**
   * Total budgeted effort in hours.
   * @example 1200
   */
  @IsNumber()
  @IsOptional()
  budgetHours?: number;

  /**
   * Total budgeted cost in the project's currency.
   * @example 150000
   */
  @IsNumber()
  @IsOptional()
  budgetCost?: number;

  /**
   * Expected revenue from the project.
   * @example 200000
   */
  @IsNumber()
  @IsOptional()
  revenue?: number;

  /**
   * Service-level agreement type applied to the project.
   * @example "STANDARD"
   */
  @IsString()
  @IsOptional()
  slaType?: string;

  /**
   * ID of the profit center the project is billed against.
   * @example "b1d4c8f2-3e5a-4c9b-8d6f-1a2b3c4d5e6f"
   */
  @IsString()
  @IsOptional()
  profitCenterId?: string;

  /**
   * ID of the currency used for budget and revenue figures.
   * @example "a9f8e7d6-c5b4-4a3f-9e8d-7c6b5a4f3e2d"
   */
  @IsString()
  @IsOptional()
  currencyId?: string;
}
