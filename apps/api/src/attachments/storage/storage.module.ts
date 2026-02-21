import { Module } from '@nestjs/common';
import { env } from '../../config/env';
import type { StorageService } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';

const storageFactory = {
  provide: 'STORAGE_SERVICE',
  useFactory(): StorageService {
    if (env.STORAGE_PROVIDER === 's3') {
      return new S3StorageService();
    }
    return new LocalStorageService();
  },
};

@Module({
  providers: [storageFactory],
  exports: ['STORAGE_SERVICE'],
})
export class StorageModule {}
