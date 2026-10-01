import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBaselineDto {
  /**
   * Identifier of the project the baseline snapshot is captured for.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsNotEmpty()
  projectId: string;

  /**
   * Human-readable label identifying this baseline snapshot.
   * @example "Q3 Kickoff Baseline"
   */
  @IsString()
  @IsNotEmpty()
  label: string;
}
