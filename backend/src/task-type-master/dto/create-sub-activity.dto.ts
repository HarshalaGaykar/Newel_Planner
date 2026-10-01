import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateSubActivityDto {
  /**
   * ID of the parent activity this sub-activity belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsNotEmpty()
  activityId: string;

  /**
   * Display name of the sub-activity.
   * @example "Draft functional specification"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  /**
   * Optional longer description of the sub-activity.
   * @example "Detailed breakdown of the functional specification tasks"
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
