import { IsOptional, IsString, IsUUID, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class MaturityReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  startMonth?: string;

  @IsOptional()
  @IsString()
  endMonth?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;
}
