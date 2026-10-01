import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsBoolean } from 'class-validator';
import { TrainingType } from '@prisma/client';

export class CreateProgramDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TrainingType)
  type: TrainingType;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsNumber()
  durationHrs: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];
}
