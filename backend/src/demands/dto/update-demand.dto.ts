import { PartialType } from '@nestjs/mapped-types';
import { CreateDemandDto } from './create-demand.dto';

export class UpdateDemandDto extends PartialType(CreateDemandDto) {}
