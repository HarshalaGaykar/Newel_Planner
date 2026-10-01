import { PartialType } from '@nestjs/mapped-types';
import { CreatePriorityMasterDto } from './create-priority-master.dto';

export class UpdatePriorityMasterDto extends PartialType(CreatePriorityMasterDto) {}
