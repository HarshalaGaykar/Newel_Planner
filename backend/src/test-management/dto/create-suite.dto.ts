import { IsString, IsOptional } from 'class-validator';

export class CreateSuiteDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  projectId: string;
}
