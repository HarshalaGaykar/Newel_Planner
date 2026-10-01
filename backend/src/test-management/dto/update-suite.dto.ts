import { IsString, IsOptional } from 'class-validator';

export class UpdateSuiteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
