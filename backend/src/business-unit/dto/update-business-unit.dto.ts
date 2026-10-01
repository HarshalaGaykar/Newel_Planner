import { PartialType } from '@nestjs/mapped-types';
import { CreateBusinessUnitDto } from './create-business-unit.dto';

export class UpdateBusinessUnitDto extends PartialType(CreateBusinessUnitDto) {}
