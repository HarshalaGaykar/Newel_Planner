import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDemandCommentDto {
  /**
   * The text content of the comment being added to the demand.
   * @example "Please clarify the expected budget for this request."
   */
  @IsString()
  @IsNotEmpty()
  body: string;
}
