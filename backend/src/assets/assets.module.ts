import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExportService } from '../reports/export.service';

@Module({
  imports: [PrismaModule],
  controllers: [AssetsController],
  providers: [AssetsService, ExportService],
  exports: [AssetsService],
})
export class AssetsModule {}
