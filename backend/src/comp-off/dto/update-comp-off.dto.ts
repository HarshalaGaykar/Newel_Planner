import { IsIn, IsOptional } from 'class-validator';

export class UpdateCompOffDto {
  /**
   * Current lifecycle status of the comp-off request.
   * @example "APPROVED"
   */
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'UTILISED'])
  @IsOptional()
  status?: string;
}
