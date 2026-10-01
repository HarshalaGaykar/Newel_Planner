import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSkillCategoryDto {
  /**
   * The display name of the skill category.
   * @example "Frontend Development"
   */
  @IsString()
  @IsNotEmpty({ message: 'Name of the category is required' })
  @MaxLength(100)
  name!: string;

  /**
   * An optional description explaining the purpose or scope of the skill category.
   * @example "Skills related to building user-facing web interfaces"
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateSkillCategoryDto {
  /**
   * The updated display name of the skill category.
   * @example "Frontend Development"
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name of the category cannot be empty' })
  @MaxLength(100)
  name?: string;

  /**
   * The updated description explaining the purpose or scope of the skill category.
   * @example "Skills related to building user-facing web interfaces"
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Whether the skill category is currently active and available for use.
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
