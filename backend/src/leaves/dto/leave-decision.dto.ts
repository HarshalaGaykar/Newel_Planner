import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LeaveDecisionDto {
  /**
   * Approver's note on the decision, included in the email sent back to the
   * requester. Especially useful on rejection.
   * @example "Team is short-staffed that week — please re-apply for the following one."
   */
  @ApiPropertyOptional({ description: 'Approver note included in the decision email' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
