import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async remove(id: string): Promise<void> {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity || activity.type !== 'file_uploaded') {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    const payload = (activity.payload as Record<string, unknown>) ?? {};
    const relativePath = payload.path as string | undefined;
    const filename = (payload.filename as string) ?? 'unknown';
    const mimeType = payload.mimeType as string | undefined;
    const size = payload.size as number | undefined;

    if (relativePath) {
      try {
        const fullPath = path.join(process.cwd(), 'uploads', relativePath);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
        }
      } catch {
        // Proceed even if file is missing or unlink fails
      }
    }

    await this.prisma.activity.delete({ where: { id } });

    await this.activityService.createRaw({
      entityType: activity.entityType,
      entityId: activity.entityId,
      type: 'file_deleted',
      payload: {
        attachmentId: id,
        fileName: filename,
        ...(mimeType != null && { mimeType }),
        ...(size != null && { size }),
      },
    });
  }
}
