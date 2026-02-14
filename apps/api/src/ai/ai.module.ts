import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiAdapter } from './adapter/ai-adapter.interface';
import { OpenAiAdapter } from './adapter/openai.adapter';

@Module({
  imports: [PrismaModule, ActivityModule],
  controllers: [AiController],
  providers: [
    AiService,
    { provide: AiAdapter, useClass: OpenAiAdapter },
  ],
})
export class AiModule {}
