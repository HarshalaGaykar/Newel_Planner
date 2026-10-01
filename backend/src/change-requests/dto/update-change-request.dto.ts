import { PartialType } from '@nestjs/mapped-types';
import { CreateChangeRequestDto } from './create-change-request.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { CRStatus } from '@prisma/client';

export class UpdateChangeRequestDto extends PartialType(CreateChangeRequestDto) {
  /**
   * The current workflow status of the change request.
   * @example "SUBMITTED"
   */
  @IsEnum(CRStatus)
  @IsOptional()
  status?: CRStatus;
}
