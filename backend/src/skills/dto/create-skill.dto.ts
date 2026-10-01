import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateSkillDto {
  /**
   * The display name of the skill.
   * @example "React"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * An optional description explaining the skill and its scope.
   * @example "Building interactive user interfaces with the React library"
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * The unique identifier of the category this skill belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsOptional()
  categoryId?: string;
}
