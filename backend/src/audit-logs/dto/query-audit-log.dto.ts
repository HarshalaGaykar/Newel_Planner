import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryAuditLogDto {
  /**
   * Restricts results to audit entries recorded for a specific application module.
   * @example "PROJECT"
   */
  @ApiPropertyOptional({ description: 'Filter by module (e.g. PROJECT, USER)' })
  @IsOptional()
  @IsString()
  module?: string;

  /**
   * Restricts results to audit entries tied to a single entity record by its identifier.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @ApiPropertyOptional({ description: 'Filter by entity id' })
  @IsOptional()
  @IsString()
  entityId?: string;

  /**
   * Restricts results to a specific type of change action performed on the entity.
   * @example "UPDATE"
   */
  @ApiPropertyOptional({ description: 'Filter by action (CREATE, UPDATE, DELETE)' })
  @IsOptional()
  @IsString()
  action?: string;

  /**
   * Restricts results to audit entries produced by a specific acting user.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @ApiPropertyOptional({ description: 'Filter by actor userId' })
  @IsOptional()
  @IsString()
  userId?: string;

  /**
   * One-based page number to retrieve from the paginated result set.
   * @example 1
   */
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  /**
   * Maximum number of audit entries to return per page (capped at 100).
   * @example 20
   */
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;
}
