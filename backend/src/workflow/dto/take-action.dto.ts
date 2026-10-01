import { IsString, IsEnum, IsOptional } from 'class-validator';
import { WorkflowAction } from '@prisma/client';

export class TakeActionDto {
  @IsEnum(WorkflowAction)
  action: WorkflowAction;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsString()
  @IsOptional()
  delegateTo?: string;
}
