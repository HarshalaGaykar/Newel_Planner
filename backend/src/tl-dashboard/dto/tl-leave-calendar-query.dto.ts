import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TlLeaveCalendarQueryDto {
  /**
   * One-based calendar month to render.
   * @example 9
   */
  @IsInt()
  @Min(1)
  @Max(12)
  @Transform(({ value }) => parseInt(value, 10))
  month!: number;

  /**
   * Calendar year to render.
   * @example 2026
   */
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Transform(({ value }) => parseInt(value, 10))
  year!: number;

  /**
   * IANA time zone the month's day boundaries are computed in. Defaults to UTC.
   * @example "Asia/Kolkata"
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeZone?: string;
}
