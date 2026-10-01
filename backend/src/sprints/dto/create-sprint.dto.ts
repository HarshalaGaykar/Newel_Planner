import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateSprintDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  goal?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsIn(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  capacity?: number;
}
