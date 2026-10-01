import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateRemarkDto {
  /**
   * Date the remark applies to or was recorded.
   * @example "2026-07-15"
   */
  @IsDateString()
  date: string;

  /**
   * Free-text remark or note about the delivery item.
   * @example "Awaiting client approval on final finishes."
   */
  @IsString()
  @IsNotEmpty()
  content: string;
}
