import { PartialType } from '@nestjs/mapped-types';
import { CreateProfitCenterDto } from './create-profit-center.dto';

export class UpdateProfitCenterDto extends PartialType(CreateProfitCenterDto) {}
