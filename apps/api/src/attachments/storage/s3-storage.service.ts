import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import type { StorageService, UploadResult } from './storage.interface';

@Injectable()
export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const bucket = env.S3_BUCKET;
    if (!bucket) {
      throw new Error('S3_BUCKET is required when STORAGE_PROVIDER=s3');
    }
    this.bucket = bucket;
    const region = env.S3_REGION ?? 'us-east-1';
    this.client = new S3Client({
      region,
      ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT, forcePathStyle: true }),
      ...(env.AWS_ACCESS_KEY_ID &&
        env.AWS_SECRET_ACCESS_KEY && {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }),
    });
  }

  async upload(
    buffer: Buffer,
    key: string,
    options?: { contentType?: string; metadata?: Record<string, string> },
  ): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: options?.contentType ?? 'application/octet-stream',
        Metadata: options?.metadata,
      }),
    );
    return { key, bucket: this.bucket };
  }

  async delete(key: string, bucket: string | null): Promise<void> {
    const b = bucket ?? this.bucket;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: b, Key: key }),
    );
  }

  async getSignedDownloadUrl(
    key: string,
    bucket: string | null,
    options?: { expiresInSeconds?: number; responseContentDisposition?: string },
  ): Promise<string> {
    const b = bucket ?? this.bucket;
    const expiresIn = options?.expiresInSeconds ?? 3600;
    const command = new GetObjectCommand({
      Bucket: b,
      Key: key,
      ...(options?.responseContentDisposition && {
        ResponseContentDisposition: options.responseContentDisposition,
      }),
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
