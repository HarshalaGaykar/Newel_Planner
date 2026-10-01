import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsArray } from 'class-validator';
import { VendorCategory, VendorStatus } from '@prisma/client';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  vendorName: string;

  @IsEnum(VendorCategory)
  @IsOptional()
  category?: VendorCategory;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  pan?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsDateString()
  @IsOptional()
  agreementStart?: string;

  @IsDateString()
  @IsOptional()
  agreementEnd?: string;

  @IsArray()
  @IsOptional()
  rateCards?: any[];

  @IsEnum(VendorStatus)
  @IsOptional()
  status?: VendorStatus;
}
