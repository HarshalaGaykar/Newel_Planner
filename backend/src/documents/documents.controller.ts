import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private configService: ConfigService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a new document version for an entity' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.documentsService.upload(
      dto.entityType,
      dto.entityId,
      dto.docType,
      file,
      req.user.userId,
      dto.description,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get the latest documents for an entity grouped by document type' })
  async getDocuments(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    const documents = await this.documentsService.getLatestDocuments(entityType, entityId);
    
    // Group by docType
    const grouped = documents.reduce((acc, doc) => {
      if (!acc[doc.docType]) {
        acc[doc.docType] = [];
      }
      acc[doc.docType].push(doc);
      return acc;
    }, {} as Record<string, typeof documents>);

    return grouped;
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get the version history for a document by ID' })
  async getVersions(
    @Param('id') id: string,
  ) {
    const doc = await this.documentsService.getDocumentById(id);
    return this.documentsService.getVersionHistory(doc.entityType, doc.entityId, doc.docType);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a document file by ID' })
  async download(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.documentsService.getDocumentById(id);
    const basePath = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    const filePath = path.join(basePath, doc.fileUrl);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on server');
    }

    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${doc.name}"`,
      'Content-Length': doc.sizeBytes.toString(),
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document by ID' })
  async delete(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.documentsService.delete(id, req.user.userId);
  }
}
