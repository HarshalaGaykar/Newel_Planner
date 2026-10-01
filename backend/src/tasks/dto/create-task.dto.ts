import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { CRPhase } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['BACKLOG', 'TODO', 'WIP', 'QA', 'COMPLETED'])
  @IsOptional()
  status?: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  @IsOptional()
  priority?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  estimatedEffort?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  complexity?: number;

  @IsString()
  @IsOptional()
  techStack?: string;

  @IsString()
  @IsOptional()
  taskType?: string;

  @IsUUID()
  @IsOptional()
  taskTypeMasterId?: string;

  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsOptional()
  milestoneId?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  // Full set of assignees (drawn from the project's allocated resources).
  // The primary `assigneeId` is kept in sync with the first entry.
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assigneeIds?: string[];

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  predecessorId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  skillIds?: string[];

  @IsBoolean()
  @IsOptional()
  isCritical?: boolean;

  @IsIn(['PHASE', 'MODULE', 'TASK', 'SUBTASK'])
  @IsOptional()
  wbsLevel?: string;

  @IsDateString()
  @IsOptional()
  plannedStart?: string;

  @IsDateString()
  @IsOptional()
  plannedEnd?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  plannedHours?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  progressPct?: number;

  @IsString()
  @IsOptional()
  crId?: string;

  @IsString()
  @IsOptional()
  sprintId?: string;

  @IsIn(['REQUIREMENT', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'UAT', 'DEPLOYMENT'])
  @IsOptional()
  phase?: CRPhase;

  /** Hand-entered hours/day. Stored only when dailyEffortOverride is true;
   *  otherwise the server derives dailyEffort from effort + working days. */
  @IsNumber()
  @Min(0)
  @Max(24)
  @IsOptional()
  dailyEffort?: number;

  /** True when dailyEffort was typed by hand (manual override). */
  @IsBoolean()
  @IsOptional()
  dailyEffortOverride?: boolean;
}
