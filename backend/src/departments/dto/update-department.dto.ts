import { IsString, IsOptional } from 'class-validator';

export class UpdateDepartmentDto {
  /**
   * The updated unique name of the department.
   * @example "Engineering"
   */
  @IsString()
  @IsOptional()
  name?: string;

  /**
   * The updated description outlining the department's purpose or scope.
   * @example "Handles software development and platform engineering"
   */
  @IsString()
  @IsOptional()
  description?: string;
}
