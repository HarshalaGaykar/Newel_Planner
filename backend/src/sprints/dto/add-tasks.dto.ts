import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AddTasksDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  taskIds: string[];
}
