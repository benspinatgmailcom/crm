import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import type { StorageProvider } from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly expiresSeconds: number;

  constructor() {
    const bucket = env.S3_BUCKET_NAME ?? env.S3_BUCKET;
    if (!bucket) {
      throw new Error('S3_BUCKET_NAME or S3_BUCKET is required when STORAGE_DRIVER=s3');
    }
    this.bucket = bucket;
    this.prefix = (env.S3_KEY_PREFIX ?? '').replace(/\/$/, '');
    this.expiresSeconds = env.S3_URL_EXPIRES_SECONDS ?? 3600;
    const region = env.AWS_REGION ?? env.S3_REGION ?? 'us-east-1';
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

  private fullKey(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async putObject(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ key: string }> {
    const fullKey = this.fullKey(params.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );
    return { key: params.key };
  }

  async getSignedUrl(params: {
    key: string;
    expiresSeconds: number;
  }): Promise<string> {
    const fullKey = this.fullKey(params.key);
    const expiresIn = params.expiresSeconds ?? this.expiresSeconds;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(params: { key: string }): Promise<void> {
    const fullKey = this.fullKey(params.key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: fullKey }),
    );
  }
}
