import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body for an assignee's remarks-only update — no status change. */
export class AddActivityRemarkDto {
  @ApiProperty({ description: 'Remark or progress note to record against the activity' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  remarks: string;
}
