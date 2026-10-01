import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { TestRunStatus, TestEnvironment } from '@prisma/client';

export class UpdateRunDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsEnum(TestRunStatus)
  status?: TestRunStatus;

  @IsOptional()
  @IsEnum(TestEnvironment)
  environment?: TestEnvironment;

  @IsOptional()
  @IsDateString()
  plannedAt?: string;
}
