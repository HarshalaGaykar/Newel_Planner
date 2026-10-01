import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsBoolean } from 'class-validator';
import { TrainingType } from '@prisma/client';

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TrainingType)
  type?: TrainingType;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  durationHrs?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];
}
