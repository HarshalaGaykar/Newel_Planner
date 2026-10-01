import { PartialType } from '@nestjs/mapped-types';
import { CreateAllocationInsightDto } from './create-allocation-insight.dto';

export class UpdateAllocationInsightDto extends PartialType(CreateAllocationInsightDto) {}
