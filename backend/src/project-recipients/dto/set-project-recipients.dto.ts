import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectContactRole } from '@prisma/client';

export class RecipientItemDto {
  /**
   * ID of the client contact or internal user being mapped as a recipient.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsNotEmpty()
  id: string;

  /**
   * Whether this recipient should be on the To or CC line.
   * @example "TO"
   */
  @IsEnum(ProjectContactRole)
  role: ProjectContactRole;
}

export class SetProjectRecipientsDto {
  /**
   * Client contacts (from the project's linked client) mapped as recipients.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientItemDto)
  @IsOptional()
  clientContacts?: RecipientItemDto[];

  /**
   * Active internal Planner users mapped as recipients.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientItemDto)
  @IsOptional()
  internalUsers?: RecipientItemDto[];
}
