import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UPLOADS_DIR } from '../uploads.constants';
import type { StorageProvider } from './storage-provider.interface';

@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  async putObject(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ key: string }> {
    const fullPath = path.join(UPLOADS_DIR, params.key);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, params.buffer);
    return { key: params.key };
  }

  async getSignedUrl(): Promise<string | null> {
    return null;
  }

  async deleteObject(params: { key: string }): Promise<void> {
    const fullPath = path.join(UPLOADS_DIR, params.key);
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore if already missing
    }
  }

  getLocalFilePath(key: string): string {
    return path.join(UPLOADS_DIR, key);
  }
}
