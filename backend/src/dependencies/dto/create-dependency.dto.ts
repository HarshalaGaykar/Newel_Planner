import {
  IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, IsDateString,
} from 'class-validator';

export class CreateDependencyDto {
  /**
   * ID of the project this dependency belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  projectId: string;

  /**
   * Short human-readable title describing the dependency.
   * @example "API contract must be finalized before integration"
   */
  @IsString()
  @IsNotEmpty()
  title: string;

  /**
   * Detailed description of the dependency and its impact.
   * @example "Frontend cannot begin work until the payments API schema is locked."
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Whether the dependency is internal to the team or on an external party.
   * @example "INTERNAL"
   */
  @IsIn(['INTERNAL', 'EXTERNAL'])
  @IsOptional()
  type?: string;

  /**
   * ID of the task that this dependency originates from.
   * @example "3fa85f64-5717-4562-b3fc-2c963f66afa6"
   */
  @IsUUID()
  @IsOptional()
  fromTaskId?: string;

  /**
   * ID of the task that this dependency points to.
   * @example "9b2e4d1c-8a3f-4b6e-9c1d-2e5f7a8b0c3d"
   */
  @IsUUID()
  @IsOptional()
  toTaskId?: string;

  /**
   * External reference identifier for a third-party or external dependency.
   * @example "VENDOR-TICKET-4821"
   */
  @IsString()
  @IsOptional()
  externalRef?: string;

  /**
   * ID of the user who owns and is accountable for this dependency.
   * @example "5d8f2a1b-6c7e-4a9d-8b3f-1e0c4d7a2b6f"
   */
  @IsUUID()
  ownerId: string;

  /**
   * Current resolution status of the dependency.
   * @example "OPEN"
   */
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'BLOCKED'])
  @IsOptional()
  status?: string;

  /**
   * Date by which the dependency should be resolved (ISO 8601).
   * @example "2026-07-15"
   */
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
