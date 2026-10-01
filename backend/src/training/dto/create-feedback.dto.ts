import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  trainerRating?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  contentRating?: number;

  @IsString()
  @IsOptional()
  comments?: string;
}
