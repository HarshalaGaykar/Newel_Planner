import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, Min, Max } from 'class-validator';

export class CreateMilestoneDto {
  /**
   * The display name of the milestone.
   * @example "Design Phase Completion"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * A detailed description of the milestone's scope and deliverables.
   * @example "Complete all UI/UX design mockups and get client sign-off"
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * The billing amount associated with reaching this milestone.
   * @example 15000
   */
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  /**
   * The completion percentage of the milestone (0-100).
   * @example 60
   */
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  completion?: number;

  /**
   * The ID of the project this milestone belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsNotEmpty()
  projectId: string;

  /**
   * The target date by which the milestone should be achieved.
   * @example "2026-07-15"
   */
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  /**
   * The date on which the milestone was actually achieved.
   * @example "2026-07-15T09:00:00Z"
   */
  @IsDateString()
  @IsOptional()
  achievedAt?: string;

  /**
   * The current status of the milestone.
   * @example "WIP"
   */
  @IsString()
  @IsOptional()
  status?: string;
}
