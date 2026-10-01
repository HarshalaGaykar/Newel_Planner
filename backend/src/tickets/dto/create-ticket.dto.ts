import { IsArray, IsNotEmpty, IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';

export class CreateTicketDto {
  /**
   * Short, human-readable title summarizing the ticket.
   * @example "Login page returns 500 on submit"
   */
  @IsString()
  @IsNotEmpty()
  title: string;

  /**
   * Detailed description of the issue or request captured by the ticket.
   * @example "Users are unable to log in; the API responds with a 500 error when submitting valid credentials."
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Priority level of the ticket indicating how urgently it should be handled.
   * @example "HIGH"
   */
  @IsString()
  @IsOptional()
  priority?: string;

  /**
   * Current workflow status of the ticket.
   * @example "WIP"
   */
  @IsString()
  @IsOptional()
  status?: string;

  /**
   * Category or nature of the ticket (e.g. bug, feature, task).
   * @example "BUG"
   */
  @IsString()
  @IsOptional()
  type?: string;

  /**
   * Identifier of the project the ticket belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsNotEmpty()
  projectId: string;

  /**
   * Identifier of the primary user assigned to work on the ticket.
   * @example "3fa85f64-5717-4562-b3fc-2c963f66afa6"
   */
  @IsString()
  @IsOptional()
  assigneeId?: string;

  // Full set of assignees (drawn from the project's allocated resources).
  // The primary `assigneeId` is kept in sync with the first entry.
  /**
   * Full set of user identifiers assigned to the ticket, drawn from the project's allocated resources.
   * @example ["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assigneeIds?: string[];

  /**
   * Target date by which the ticket is expected to be resolved.
   * @example "2026-07-15"
   */
  @IsDateString()
  @IsOptional()
  targetDate?: string;

  /**
   * Estimated complexity of the ticket used for planning and effort sizing.
   * @example "3"
   */
  @IsString()
  @IsOptional()
  complexity?: string;

  /**
   * Technology stack relevant to resolving the ticket.
   * @example "NestJS, PostgreSQL"
   */
  @IsString()
  @IsOptional()
  techStack?: string;

  /**
   * Whether the ticket's service-level agreement has been breached.
   * @example false
   */
  @IsBoolean()
  @IsOptional()
  isSlaBreached?: boolean;
}
