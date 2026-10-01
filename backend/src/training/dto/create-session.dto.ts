import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { TrainingMode } from '@prisma/client';

export class CreateSessionDto {
  @IsString()
  programId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(TrainingMode)
  mode: TrainingMode;

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
}
