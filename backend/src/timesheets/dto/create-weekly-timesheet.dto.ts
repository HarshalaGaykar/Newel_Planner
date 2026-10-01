import { IsNotEmpty, IsOptional, IsString, IsUUID, IsNumber, IsDateString, Min, IsEnum } from 'class-validator';
import { TimesheetTaskType } from '@prisma/client';

export class CreateTimesheetEntryDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

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
  activity?: string;

  @IsString()
  @IsOptional()
  subActivity?: string;

  @IsString()
  @IsOptional()
  activityMasterId?: string;

  @IsString()
  @IsOptional()
  taskSubActivityMasterId?: string;

  @IsNumber()
  @Min(0.1)
  @IsNotEmpty()
  hours: number;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  timeZone?: string;
}

export class CreateWeeklyTimesheetDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
