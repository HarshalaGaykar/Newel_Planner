import { IsNumber, IsDateString, IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class UpdateMaturityDto {
  @IsDateString()
  forTheMonth: string;

  @IsNumber()
  @IsOptional()
  maturityValue?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  remarks?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
