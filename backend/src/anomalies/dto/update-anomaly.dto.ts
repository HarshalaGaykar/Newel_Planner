import { PartialType } from '@nestjs/mapped-types';
import { CreateAnomalyDto } from './create-anomaly.dto';

export class UpdateAnomalyDto extends PartialType(CreateAnomalyDto) {}
