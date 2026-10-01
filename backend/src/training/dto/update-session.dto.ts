import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { TrainingMode, SessionStatus } from '@prisma/client';

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TrainingMode)
  mode?: TrainingMode;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @IsOptional()
  @IsNumber()
  maxCapacity?: number;

  @IsOptional()
  @IsString()
  trainerId?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}
