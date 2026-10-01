import { IsArray, IsString } from 'class-validator';

export class AddCasesToRunDto {
  @IsArray()
  @IsString({ each: true })
  caseIds: string[];
}
