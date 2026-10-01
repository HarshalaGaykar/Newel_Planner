import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateSubActivityDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
