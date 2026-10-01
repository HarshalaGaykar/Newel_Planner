import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  /**
   * The unique name of the department.
   * @example "Engineering"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * An optional description outlining the department's purpose or scope.
   * @example "Handles software development and platform engineering"
   */
  @IsString()
  @IsOptional()
  description?: string;
}
