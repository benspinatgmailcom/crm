import { Module } from '@nestjs/common';
import { env } from '../../config/env';
import type { StorageProvider } from './storage-provider.interface';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';

const driver = env.STORAGE_DRIVER ?? env.STORAGE_PROVIDER ?? 'local';

const defaultProviderFactory = {
  provide: 'STORAGE_PROVIDER',
  useFactory(): StorageProvider {
    if (driver === 's3') {
      return new S3StorageProvider();
    }
    return new LocalDiskStorageProvider();
  },
};

const s3ProviderFactory = {
  provide: 'STORAGE_PROVIDER_S3',
  useFactory(): StorageProvider | null {
    if (env.S3_BUCKET_NAME ?? env.S3_BUCKET) {
      return new S3StorageProvider();
    }
    return null;
  },
};

@Module({
  providers: [
    LocalDiskStorageProvider,
    defaultProviderFactory,
    s3ProviderFactory,
    {
      provide: 'STORAGE_DRIVER',
      useValue: driver,
    },
  ],
  exports: [
    'STORAGE_PROVIDER',
    'STORAGE_PROVIDER_S3',
    'STORAGE_DRIVER',
    LocalDiskStorageProvider,
  ],
})
export class StorageModule {}
