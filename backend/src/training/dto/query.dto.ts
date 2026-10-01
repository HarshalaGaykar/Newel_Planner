import { IsOptional, IsString, IsEnum } from 'class-validator';
import { TrainingType, SessionStatus } from '@prisma/client';

export class ProgramQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(TrainingType)
  type?: TrainingType;

  @IsOptional()
  @IsString()
  search?: string;
}

export class SessionQueryDto {
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
