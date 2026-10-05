import { IsBoolean, IsDateString, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateAppFeatureDto {
  @IsString()
  title: string;

  @IsString()
  shortDescription: string;

  @IsOptional()
  @IsString()
  fullDescription?: string;

  @IsOptional()
  @IsString()
  iconName?: string;

  @IsOptional()
  @IsString()
  featureUrl?: string;

  @IsOptional()
  @IsString()
  demoVideoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsArray()
  @IsString({ each: true })
  roles: string[];
}
