import { PartialType } from '@nestjs/mapped-types';
import { CreateDependencyDto } from './create-dependency.dto';

export class UpdateDependencyDto extends PartialType(CreateDependencyDto) {}
