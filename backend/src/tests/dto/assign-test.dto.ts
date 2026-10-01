import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum AssignmentTargetDto {
  USER = 'USER',
  DEPARTMENT = 'DEPARTMENT',
  ROLE = 'ROLE',
}

export class AssignTestDto {
  @IsEnum(AssignmentTargetDto)
  target: AssignmentTargetDto;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  roleId?: string;

  @IsOptional()
  dueDate?: string;
}
