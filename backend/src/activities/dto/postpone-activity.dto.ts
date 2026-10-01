import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class PostponeActivityDto {
  /**
   * The new start of the window. Postponing always moves the activity to a new
   * window rather than nudging it by a fixed amount.
   * @example "2026-08-05T09:30:00.000Z"
   */
  @ApiProperty({ description: 'New start date-time (ISO)' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ description: 'New end date-time (ISO)' })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ description: 'Why it moved — shown to assignees' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
