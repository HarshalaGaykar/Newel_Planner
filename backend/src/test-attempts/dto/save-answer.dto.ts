import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class SaveAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  selectedOptions: string[];
}
