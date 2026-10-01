import { IsString, IsOptional, IsDateString, IsArray, IsEnum } from 'class-validator';
import { TestEnvironment } from '@prisma/client';

export class CreateRunDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsEnum(TestEnvironment)
  environment?: TestEnvironment;

  @IsOptional()
  @IsDateString()
  plannedAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  caseIds?: string[];
}
