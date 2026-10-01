import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { TestCasePriority, TestCaseStatus, TestCaseType, TestCaseCategory } from '@prisma/client';

export class UpdateCaseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  preconditions?: string;

  @IsOptional()
  @IsArray()
  steps?: { order: number; action: string; expected: string }[];

  @IsOptional()
  @IsString()
  expectedResult?: string;

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
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  automationId?: string;

  @IsOptional()
  @IsString()
  requirementId?: string;

  @IsOptional()
  @IsString()
  suiteId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
