import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePublicHolidayDto } from './create-public-holiday.dto';

export class BulkUploadPublicHolidayDto {
  /**
   * The list of public holidays to create in a single bulk operation.
   * @example [{ "name": "Independence Day", "date": "2026-08-15", "type": "National", "isGlobal": true }]
   */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePublicHolidayDto)
  holidays: CreatePublicHolidayDto[];
}
