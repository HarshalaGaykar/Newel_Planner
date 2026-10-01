import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { IStorageService } from './storage.service';
import { DocType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'application/zip',
  'application/x-zip-compressed'
];

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    @Inject('STORAGE_SERVICE') private storageService: IStorageService,
  ) {}

  async upload(
    entityType: string,
    entityId: string,
    docType: DocType,
    file: Express.Multer.File,
    uploadedById: string,
    description?: string,
  ) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type.');
    }

    const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

    if (file.size > maxFileSizeBytes) {
      throw new BadRequestException(`File size exceeds ${maxFileSizeMB}MB limit.`);
    }

    const uuid = uuidv4();
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${uuid}-${safeOriginalName}`;
    const filePath = path.join(entityType, entityId, docType, filename).replace(/\\/g, '/');

    // 5. Call storageService.save()
    const fileUrl = await this.storageService.save(file.buffer, filePath);

    // 6. Find existing latest version
    const existingDocument = await this.prisma.document.findFirst({
      where: {
        entityType,
        entityId,
        docType,
        isLatest: true,
      },
    });

    let newVersion = 1;

    // 7. If exists, set isLatest = false
    if (existingDocument) {
      newVersion = existingDocument.version + 1;
      await this.prisma.document.update({
        where: { id: existingDocument.id },
        data: { isLatest: false },
      });
    }

    // 8. Create new Document record
    const document = await this.prisma.document.create({
      data: {
        entityType,
        entityId,
        docType,
        name: safeOriginalName,
        originalName: file.originalname,
        fileUrl,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        version: newVersion,
        isLatest: true,
        uploadedById,
        description,
      },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    return document;
  }

  async getLatestDocuments(entityType: string, entityId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        entityType,
        entityId,
        isLatest: true,
      },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Enhance with full URL
    return documents.map(doc => ({
      ...doc,
      fullUrl: this.storageService.getUrl(doc.fileUrl),
    }));
  }

  async getVersionHistory(entityType: string, entityId: string, docType: DocType) {
    const documents = await this.prisma.document.findMany({
      where: {
        entityType,
        entityId,
        docType,
      },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: {
        version: 'desc',
      },
    });

    return documents.map(doc => ({
      ...doc,
      fullUrl: this.storageService.getUrl(doc.fileUrl),
    }));
  }

  async getDocumentById(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async delete(id: string, requesterId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!document.isLatest) {
      throw new BadRequestException('Cannot delete historical versions directly. Delete the latest document to remove all history or replace it by uploading a new version.');
    }

    // Delete all versions for this document
    const allVersions = await this.prisma.document.findMany({
      where: {
        entityType: document.entityType,
        entityId: document.entityId,
        docType: document.docType,
      },
    });

    // Delete physical files
    for (const doc of allVersions) {
      await this.storageService.delete(doc.fileUrl);
    }

    // Delete DB records
    await this.prisma.document.deleteMany({
      where: {
        entityType: document.entityType,
        entityId: document.entityId,
        docType: document.docType,
      },
    });

    return { success: true };
  }
}
