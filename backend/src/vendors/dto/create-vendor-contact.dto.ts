import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEmail } from 'class-validator';

export class CreateVendorContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
