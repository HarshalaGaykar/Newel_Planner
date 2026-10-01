import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectTimesheetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  remarks: string;
}
