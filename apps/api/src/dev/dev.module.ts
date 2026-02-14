import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';
import { SeedStoryService } from './seed-story.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [PrismaModule, ActivityModule, AttachmentsModule],
  controllers: [DevController],
  providers: [DevService, SeedStoryService],
})
export class DevModule {}
