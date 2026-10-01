import { PartialType } from '@nestjs/mapped-types';
import { CreatePublicHolidayDto } from './create-public-holiday.dto';

export class UpdatePublicHolidayDto extends PartialType(CreatePublicHolidayDto) {}
