import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalStorageService } from './storage.service';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    {
      provide: 'STORAGE_SERVICE',
      useClass: LocalStorageService,
    },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
