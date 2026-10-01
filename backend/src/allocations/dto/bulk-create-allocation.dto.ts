import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateAllocationDto } from './create-allocation.dto';

export class BulkCreateAllocationDto {
  /**
   * List of allocations to create in a single bulk request.
   * @example [{ "projectId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "startDate": "2026-07-15", "endDate": "2026-09-30" }]
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAllocationDto)
  allocations: CreateAllocationDto[];
}
