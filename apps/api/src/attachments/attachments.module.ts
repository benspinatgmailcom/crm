import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [
    PrismaModule,
    ActivityModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
