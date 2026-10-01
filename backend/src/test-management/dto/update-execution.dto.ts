import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ExecutionResult } from '@prisma/client';

export class UpdateExecutionDto {
  @IsEnum(ExecutionResult)
  result: ExecutionResult;

  @IsOptional()
  @IsString()
  actualResult?: string;

  @IsOptional()
  @IsArray()
  stepResults?: { stepOrder: number; result: ExecutionResult; actual?: string }[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  defectTicketId?: string;

  @IsOptional()
  retestRequired?: boolean;
}
