import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Attachment } from '@crm/db';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { User } from '@crm/db';
import { env } from '../config/env';
import { UPLOADS_DIR } from './uploads.constants';
import type { StorageProvider } from './storage/storage-provider.interface';
import { LocalDiskStorageProvider } from './storage/local-disk-storage.provider';

const ENTITY_TYPES = ['account', 'contact', 'lead', 'opportunity'] as const;
const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml'];

export interface DownloadResult {
  attachment: Attachment;
  signedUrl: string | null;
  localFilePath: string | null;
}

@Injectable()
export class AttachmentsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    @Inject('STORAGE_PROVIDER') private readonly defaultProvider: StorageProvider,
    @Inject('STORAGE_PROVIDER_S3') @Optional() private readonly s3Provider: StorageProvider | null,
    @Inject('STORAGE_DRIVER') private readonly currentDriver: string,
    private readonly localProvider: LocalDiskStorageProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.currentDriver === 'local') {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
  }

  private getProvider(driver: string): StorageProvider {
    const effective = driver === 's3' ? 's3' : 'local';
    if (effective === 's3') {
      if (!this.s3Provider) {
        throw new BadRequestException('S3 storage not configured; cannot serve S3 attachment');
      }
      return this.s3Provider;
    }
    return this.localProvider;
  }

  private isTextExtractable(mimeType: string): boolean {
    const lower = mimeType.toLowerCase();
    return TEXT_MIME_PREFIXES.some((p) => {
      if (p.endsWith('/')) return lower.startsWith(p);
      return lower === p;
    });
  }

  private extractTextFromBuffer(buffer: Buffer, mimeType: string): string | null {
    if (!this.isTextExtractable(mimeType)) return null;
    try {
      return buffer.toString('utf-8').slice(0, 100_000);
    } catch {
      return null;
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
  }

  async create(
    entityType: string,
    entityId: string,
    file: Express.Multer.File,
    user: User,
  ): Promise<Attachment> {
    if (!ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])) {
      throw new BadRequestException(
        `entityType must be one of: ${ENTITY_TYPES.join(', ')}`,
      );
    }
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    await this.validateEntityExists(entityType, entityId);

    const id = crypto.randomUUID();
    const safeName = this.sanitizeFileName(file.originalname || 'file');
    const timestamp = Date.now();
    const storageKey = path
      .join(entityType, entityId, `${timestamp}-${safeName}`)
      .replace(/\\/g, '/');

    const contentType = file.mimetype || 'application/octet-stream';
    const extractedText = this.extractTextFromBuffer(file.buffer, contentType);

    const storageDriver = env.STORAGE_DRIVER ?? env.STORAGE_PROVIDER ?? 'local';
    const provider = this.getProvider(storageDriver);

    await provider.putObject({
      key: storageKey,
      buffer: file.buffer,
      contentType,
    });

    const bucket = storageDriver === 's3' ? (env.S3_BUCKET_NAME ?? env.S3_BUCKET ?? null) : null;

    const attachment = await this.prisma.attachment.create({
      data: {
        id,
        entityType,
        entityId,
        fileName: file.originalname || 'file',
        mimeType: contentType,
        size: file.size,
        storageKey,
        storageDriver,
        bucket,
        uploadedByUserId: user.id,
        extractedText,
      },
    });

    await this.activityService.createRaw({
      entityType,
      entityId,
      type: 'file_uploaded',
      payload: {
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      },
    });

    return attachment;
  }

  async findAll(entityType: string, entityId: string): Promise<Attachment[]> {
    return this.prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Attachment> {
    const a = await this.prisma.attachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Attachment ${id} not found`);
    return a;
  }

  async getDownload(id: string): Promise<DownloadResult> {
    const attachment = await this.findOne(id);
    const driver = attachment.storageDriver ?? (attachment.bucket ? 's3' : 'local');
    const provider = this.getProvider(driver);

    const expiresSeconds = env.S3_URL_EXPIRES_SECONDS ?? 3600;
    const signedUrl = await provider.getSignedUrl({
      key: attachment.storageKey,
      expiresSeconds,
    });

    const localProvider = provider as StorageProvider & { getLocalFilePath?: (key: string) => string | null };
    const localFilePath =
      signedUrl === null && localProvider.getLocalFilePath
        ? localProvider.getLocalFilePath(attachment.storageKey)
        : null;

    return {
      attachment,
      signedUrl: signedUrl ?? null,
      localFilePath,
    };
  }

  async remove(id: string, user: User): Promise<void> {
    const attachment = await this.findOne(id);
    const driver = attachment.storageDriver ?? (attachment.bucket ? 's3' : 'local');
    const provider = this.getProvider(driver);
    await provider.deleteObject({ key: attachment.storageKey });
    await this.prisma.attachment.delete({ where: { id } });
    await this.activityService.createRaw({
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      type: 'file_deleted',
      payload: {
        attachmentId: id,
        fileName: attachment.fileName,
      },
    });
  }

  async getExtractedTextForEntity(
    entityType: string,
    entityId: string,
    limit: number = 2,
    maxChars: number = 8000,
  ): Promise<string> {
    const attachments = await this.prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const parts: string[] = [];
    let total = 0;
    for (const a of attachments) {
      if (!a.extractedText) continue;
      const snippet = a.extractedText.slice(0, maxChars - total);
      if (snippet) {
        parts.push(`### Attachment: ${a.fileName}\n${snippet}`);
        total += snippet.length;
      }
      if (total >= maxChars) break;
    }
    if (parts.length === 0) return '';
    return `\n\n## Recent attachment content\n${parts.join('\n\n')}`;
  }

  private async validateEntityExists(
    entityType: string,
    entityId: string,
  ): Promise<void> {
    let exists = false;
    switch (entityType) {
      case 'account':
        exists = !!(await this.prisma.account.findUnique({ where: { id: entityId } }));
        break;
      case 'contact':
        exists = !!(await this.prisma.contact.findUnique({ where: { id: entityId } }));
        break;
      case 'lead':
        exists = !!(await this.prisma.lead.findUnique({ where: { id: entityId } }));
        break;
      case 'opportunity':
        exists = !!(await this.prisma.opportunity.findUnique({ where: { id: entityId } }));
        break;
      default:
        return;
    }
    if (!exists) {
      throw new NotFoundException(`${entityType} ${entityId} not found`);
    }
  }
}
