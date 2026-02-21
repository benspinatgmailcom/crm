import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UPLOADS_DIR } from '../uploads.constants';
import type { StorageService, UploadResult } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageService {
  async upload(
    buffer: Buffer,
    key: string,
    _options?: { contentType?: string; metadata?: Record<string, string> },
  ): Promise<UploadResult> {
    const fullPath = path.join(UPLOADS_DIR, key);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return { key, bucket: null };
  }

  async delete(key: string, _bucket: string | null): Promise<void> {
    const fullPath = path.join(UPLOADS_DIR, key);
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore if already missing
    }
  }

  async getSignedDownloadUrl(
    _key: string,
    _bucket: string | null,
    _options?: { expiresInSeconds?: number; responseContentDisposition?: string },
  ): Promise<string | null> {
    return null; // caller should proxy via getLocalFilePath
  }

  getLocalFilePath(key: string): string {
    return path.join(UPLOADS_DIR, key);
  }
}
