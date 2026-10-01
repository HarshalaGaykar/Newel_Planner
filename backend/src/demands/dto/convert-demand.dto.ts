import { IsDateString, IsString, IsNotEmpty } from 'class-validator';

export class ConvertDemandDto {
  /**
   * The date on which the resulting project should start.
   * @example "2026-07-15"
   */
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  /**
   * The user ID of the project manager assigned to the new project.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsNotEmpty()
  pmId: string;
}
