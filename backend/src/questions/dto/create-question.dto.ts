import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsArray, Min, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum QuestionTypeDto {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
}

export enum DifficultyDto {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export class QuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  bankId: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsEnum(QuestionTypeDto)
  @IsOptional()
  type?: QuestionTypeDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @ArrayMinSize(2)
  options: QuestionOptionDto[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  correctOptions: string[];

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsEnum(DifficultyDto)
  @IsOptional()
  difficulty?: DifficultyDto;

  @IsInt()
  @Min(1)
  @IsOptional()
  marks?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
