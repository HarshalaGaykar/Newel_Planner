import { IsOptional, IsString, IsEnum } from 'class-validator';
import { TestCasePriority, TestCaseStatus, TestRunStatus, TestCaseType, TestCaseCategory } from '@prisma/client';

export class SuiteQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CaseQueryDto {
  @IsOptional()
  @IsString()
  suiteId?: string;

  @IsOptional()
  @IsEnum(TestCasePriority)
  priority?: TestCasePriority;

  @IsOptional()
  @IsEnum(TestCaseStatus)
  status?: TestCaseStatus;

  @IsOptional()
  @IsEnum(TestCaseType)
  type?: TestCaseType;

  @IsOptional()
  @IsEnum(TestCaseCategory)
  category?: TestCaseCategory;

  @IsOptional()
  @IsString()
  search?: string;
}

export class RunQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsEnum(TestRunStatus)
  status?: TestRunStatus;
}
