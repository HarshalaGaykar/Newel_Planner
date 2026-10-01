import { PartialType } from '@nestjs/mapped-types';
import { CreateLeaveTypeMasterDto } from './create-leave-type-master.dto';

export class UpdateLeaveTypeMasterDto extends PartialType(CreateLeaveTypeMasterDto) {}
