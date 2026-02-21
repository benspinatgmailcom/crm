import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Attachment } from '@crm/db';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { User } from '@crm/db';
import { env } from '../config/env';
import { UPLOADS_DIR } from './uploads.constants';
import type { StorageService } from './storage/storage.interface';

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
    @Inject('STORAGE_SERVICE') private readonly storage: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (env.STORAGE_PROVIDER === 'local') {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
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
    const storageKey = path
      .join(entityType, entityId, `${id}-${safeName}`)
      .replace(/\\/g, '/');

    const contentType = file.mimetype || 'application/octet-stream';
    const extractedText = this.extractTextFromBuffer(file.buffer, contentType);

    const { bucket } = await this.storage.upload(file.buffer, storageKey, {
      contentType,
      metadata: { originalName: file.originalname || 'file' },
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        id,
        entityType,
        entityId,
        fileName: file.originalname || 'file',
        mimeType: contentType,
        size: file.size,
        storageKey,
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
    const signedUrl = await this.storage.getSignedDownloadUrl(
      attachment.storageKey,
      attachment.bucket,
      {
        expiresInSeconds: 3600,
        responseContentDisposition: `attachment; filename="${attachment.fileName.replace(/"/g, '\\"')}"`,
      },
    );
    const localStorage = this.storage as StorageService & { getLocalFilePath?: (key: string) => string | null };
    const localFilePath =
      signedUrl === null && localStorage.getLocalFilePath
        ? localStorage.getLocalFilePath(attachment.storageKey)
        : null;
    return {
      attachment,
      signedUrl: signedUrl ?? null,
      localFilePath,
    };
  }

  async remove(id: string, user: User): Promise<void> {
    const attachment = await this.findOne(id);
    await this.storage.delete(attachment.storageKey, attachment.bucket);
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
