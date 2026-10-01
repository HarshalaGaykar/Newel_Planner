import { IsString, IsNotEmpty } from 'class-validator';

export class StartAttemptDto {
  @IsString()
  @IsNotEmpty()
  testId: string;
}
