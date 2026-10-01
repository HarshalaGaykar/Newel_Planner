import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateTestDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  bankId?: string;

  @IsInt()
  @Min(1)
  duration: number;

  @IsInt()
  @Min(1)
  totalMarks: number;

  @IsInt()
  @Min(0)
  passingMarks: number;

  @IsString()
  @IsOptional()
  instructions?: string;
}
