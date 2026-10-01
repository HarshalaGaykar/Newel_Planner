import { IsOptional, IsString, IsIn } from 'class-validator';

export class QueryMaturityDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
