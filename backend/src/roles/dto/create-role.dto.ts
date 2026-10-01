import { IsNotEmpty, IsOptional, IsString, IsUUID, IsArray } from 'class-validator';

export class CreateRoleDto {
  /**
   * The unique display name of the role.
   * @example "Project Manager"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * A short description explaining the purpose and scope of the role.
   * @example "Manages projects, tasks, and team assignments"
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * The list of permission IDs to associate with this role.
   * @example ["7c9e6679-7425-40de-944b-e07fc1f90ae7"]
   */
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  permissionIds?: string[];
}
