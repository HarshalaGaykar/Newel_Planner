import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDateString,
  IsOptional, IsString, MaxLength, MinLength, IsUUID,
} from 'class-validator';

export class UpdateActivityDto {
  @ApiPropertyOptional({ description: 'Activity name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Optional longer note' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Assignee user ids', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ description: 'Start date-time (ISO)' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: 'End date-time (ISO)' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;
}
