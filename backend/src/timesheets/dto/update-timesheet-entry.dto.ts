import { IsOptional, IsString, IsNumber, IsDateString, Min, IsEnum } from 'class-validator';
import { TimesheetTaskType } from '@prisma/client';

export class UpdateTimesheetEntryDto {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  ticketId?: string;

  @IsEnum(TimesheetTaskType)
  @IsOptional()
  taskType?: TimesheetTaskType;

  @IsString()
  @IsOptional()
  activityMasterId?: string;

  @IsString()
  @IsOptional()
  taskSubActivityMasterId?: string;

  @IsNumber()
  @Min(0.1)
  @IsOptional()
  hours?: number;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  timeZone?: string;
}
