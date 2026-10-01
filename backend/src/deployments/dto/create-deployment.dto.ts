import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { TestEnvironment } from '@prisma/client';

export class CreateDeploymentDto {
  /**
   * The unique identifier of the project this deployment belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  projectId: string;

  /**
   * The target environment the deployment is being pushed to.
   * @example "UAT"
   */
  @IsEnum(TestEnvironment)
  environment: TestEnvironment;

  /**
   * The version or release tag associated with this deployment.
   * @example "v1.2.0"
   */
  @IsOptional()
  @IsString()
  version?: string;

  /**
   * The unique identifier of the sprint this deployment is linked to.
   * @example "3fa85f64-5717-4562-b3fc-2c963f66afa6"
   */
  @IsOptional()
  @IsUUID()
  sprintId?: string;

  /**
   * Free-form notes describing the deployment or its contents.
   * @example "Deployed hotfix for login regression"
   */
  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * The current status of the deployment.
   * @example "SUCCESS"
   */
  @IsOptional()
  @IsString()
  status?: string;

  /**
   * The list of task identifiers included in this deployment.
   * @example ["7c9e6679-7425-40de-944b-e07fc1f90ae7"]
   */
  @IsOptional()
  @IsString({ each: true })
  taskIds?: string[];

  /**
   * The list of ticket identifiers included in this deployment.
   * @example ["a1b2c3d4-1234-5678-90ab-cdef12345678"]
   */
  @IsOptional()
  @IsString({ each: true })
  ticketIds?: string[];
}
