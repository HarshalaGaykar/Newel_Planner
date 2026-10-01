import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDateString,
  IsOptional, IsString, MaxLength, MinLength, IsUUID,
} from 'class-validator';

export class CreateActivityDto {
  /**
   * What the activity is.
   * @example "Prepare sprint demo deck"
   */
  @ApiProperty({ description: 'Activity name' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional longer note' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /**
   * Users the activity is assigned to. Omit (or send only your own id) to keep
   * it personal — the creator is always able to see and act on it.
   */
  @ApiPropertyOptional({ description: 'Assignee user ids', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  /**
   * Start of the activity window, as an ISO date-time.
   * @example "2026-08-03T09:30:00.000Z"
   */
  @ApiProperty({ description: 'Start date-time (ISO)' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ description: 'End date-time (ISO)' })
  @IsDateString()
  endAt!: string;

  /** When true the window is normalised to cover the whole day. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;
}
