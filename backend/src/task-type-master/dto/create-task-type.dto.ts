import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateTaskTypeDto {
  /**
   * Display name of the task type.
   * @example "Development"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /**
   * Optional longer description of the task type.
   * @example "Work related to software development activities"
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
