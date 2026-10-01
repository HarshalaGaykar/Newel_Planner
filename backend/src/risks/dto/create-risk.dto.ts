import {
  IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, IsDateString,
} from 'class-validator';

export class CreateRiskDto {
  @IsUUID()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'])
  probability: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  impact: string;

  @IsString()
  @IsOptional()
  mitigation?: string;

  @IsString()
  @IsOptional()
  contingency?: string;

  @IsUUID()
  ownerId: string;

  @IsIn(['OPEN', 'MITIGATING', 'MITIGATED', 'ACCEPTED', 'CLOSED'])
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
