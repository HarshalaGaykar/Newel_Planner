import { IsString, IsBoolean, IsArray, IsOptional, IsInt, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApproverType } from '@prisma/client';

class CreateWorkflowStepDto {
  @IsInt()
  stepOrder: number;

  @IsString()
  stepName: string;

  @IsEnum(ApproverType)
  approverType: ApproverType;

  @IsString()
  @IsOptional()
  approverRoleId?: string;

  @IsString()
  @IsOptional()
  approverUserId?: string;

  @IsInt()
  @IsOptional()
  escalateAfterHours?: number;

  @IsBoolean()
  @IsOptional()
  allowDelegate?: boolean;
}

export class CreateWorkflowTemplateDto {
  @IsString()
  module: string;

  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps: CreateWorkflowStepDto[];
}
