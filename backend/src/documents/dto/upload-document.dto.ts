import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocType } from '@prisma/client';

export class UploadDocumentDto {
  /**
   * The type of entity this document is attached to.
   * @example "PROJECT"
   */
  @ApiProperty({ description: 'The entity type this document belongs to', example: 'PROJECT' })
  @IsString()
  @IsNotEmpty()
  entityType: string;

  /**
   * The unique identifier of the entity the document belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @ApiProperty({ description: 'The ID of the entity', example: 'uuid-1234' })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  /**
   * The category of the document being uploaded.
   * @example "CONTRACT"
   */
  @ApiProperty({ enum: DocType, description: 'Type of the document' })
  @IsEnum(DocType)
  @IsNotEmpty()
  docType: DocType;

  /**
   * An optional human-readable note describing the document.
   * @example "Signed client agreement for Q3 2026"
   */
  @ApiPropertyOptional({ description: 'Optional description of the document' })
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * The binary file payload to be uploaded.
   * @example "contract.pdf"
   */
  @ApiProperty({ type: 'string', format: 'binary', description: 'The file to upload' })
  file: any;
}
