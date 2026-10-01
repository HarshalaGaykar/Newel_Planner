import {
  IsEmail,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  MinLength,
  IsNumber,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmploymentStatus } from './employment-status.enum';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  employeeCode?: string | null;

  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsUUID()
  @IsOptional()
  roleId?: string;

  @IsUUID()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  departmentId?: string | null;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  skillIds?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsUUID()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  reportingAuthorityId?: string | null;

  @IsNumber()
  @IsOptional()
  baseCostPerHour?: number;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsDateString()
  @IsOptional()
  dateOfJoining?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsNumber()
  @IsOptional()
  billingRatePerHour?: number;

  @IsUUID()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  locationId?: string | null;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  shiftId?: string | null;

  @IsEnum(EmploymentStatus)
  @IsOptional()
  employmentStatus?: EmploymentStatus;
}
