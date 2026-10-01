import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateQuestionBankDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
