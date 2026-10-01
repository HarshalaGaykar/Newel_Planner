import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, Min, IsEnum } from 'class-validator';
import { TimesheetTaskType } from '@prisma/client';

export class CreateTimesheetDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

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
  @IsNotEmpty()
  activity: string;

  @IsString()
  @IsNotEmpty()
  subActivity: string;

  @IsNumber()
  @Min(0.1)
  @IsNotEmpty()
  hours: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  description?: string;
}
