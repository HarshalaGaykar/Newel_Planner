import { IsArray, IsString } from 'class-validator';

export class EnrollDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
