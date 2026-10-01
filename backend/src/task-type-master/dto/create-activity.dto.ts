import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateActivityDto {
  /**
   * ID of the parent task type this activity belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsNotEmpty()
  taskTypeId: string;

  /**
   * Display name of the activity.
   * @example "Requirement Analysis"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;
}
