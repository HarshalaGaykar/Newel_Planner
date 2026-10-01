import {
  IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, IsDateString,
} from 'class-validator';

export class CreateIssueDto {
  /**
   * Identifier of the project this issue belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  projectId: string;

  /**
   * Short, descriptive title summarizing the issue.
   * @example "Login page throws 500 error on submit"
   */
  @IsString()
  @IsNotEmpty()
  title: string;

  /**
   * Detailed description of the issue and its context.
   * @example "Users are unable to log in when the password contains special characters."
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Severity level indicating the impact of the issue.
   * @example "HIGH"
   */
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  @IsOptional()
  severity?: string;

  /**
   * Current lifecycle status of the issue.
   * @example "OPEN"
   */
  @IsIn(['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'])
  @IsOptional()
  status?: string;

  /**
   * Identifier of the user responsible for resolving the issue.
   * @example "3fa85f64-5717-4562-b3fc-2c963f66afa6"
   */
  @IsUUID()
  ownerId: string;

  /**
   * Identifier of the user who raised or reported the issue.
   * @example "9b2f41ac-1d3e-4f27-8a6c-5e4b1c0d2f88"
   */
  @IsUUID()
  @IsOptional()
  raisedById?: string;

  /**
   * Expected date and time by which the issue should be resolved.
   * @example "2026-07-15T09:00:00Z"
   */
  @IsDateString()
  @IsOptional()
  eta?: string;

  /**
   * Notes describing how the issue was resolved.
   * @example "Escaped special characters in the password validation regex."
   */
  @IsString()
  @IsOptional()
  resolution?: string;

  /**
   * Identifier of the task associated with this issue, if any.
   * @example "c56a4180-65aa-42ec-a945-5fd21dec0538"
   */
  @IsUUID()
  @IsOptional()
  taskId?: string;

  /**
   * Identifier of the support ticket linked to this issue, if any.
   * @example "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
   */
  @IsUUID()
  @IsOptional()
  ticketId?: string;
}
