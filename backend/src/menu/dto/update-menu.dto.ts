import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMenuDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\/[a-zA-Z0-9\-\/]*$/, {
    message: 'Path must start with / and contain only letters, numbers, hyphens, and slashes',
  })
  path?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  order?: number;

  // null clears the parent (moves to root); undefined means no change
  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
