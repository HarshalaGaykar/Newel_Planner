import { IsArray, ValidateNested, IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TestQuestionItemDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  marks?: number;
}

export class AddQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestQuestionItemDto)
  questions: TestQuestionItemDto[];
}
