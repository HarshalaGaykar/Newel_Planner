import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Shared body for the complete / cancel actions. */
export class ActivityActionDto {
  @ApiPropertyOptional({ description: 'Optional note recorded against the action' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
