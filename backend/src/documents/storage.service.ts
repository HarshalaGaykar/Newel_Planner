import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface IStorageService {
  save(buffer: Buffer, filePath: string): Promise<string>;
  delete(filePath: string): Promise<void>;
  getUrl(filePath: string): string;
}

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor(private configService: ConfigService) {
    this.basePath = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async save(buffer: Buffer, filePath: string): Promise<string> {
    const fullPath = path.join(this.basePath, filePath);
    const directory = path.dirname(fullPath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, buffer);
    return filePath; // Return relative path for URL generation
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file at ${fullPath}: ${error.message}`);
    }
  }

  getUrl(filePath: string): string {
    return `/uploads/${filePath.replace(/\\/g, '/')}`; // Ensure forward slashes for URLs
  }
}
