import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';
import { AiController } from './ai.controller';
import { AiDealBriefService } from './ai-deal-brief.service';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { AiAdapter } from './adapter/ai-adapter.interface';
import { OpenAiAdapter } from './adapter/openai.adapter';

@Module({
  imports: [PrismaModule, ActivityModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiDealBriefService,
    AiContextService,
    { provide: AiAdapter, useClass: OpenAiAdapter },
  ],
  exports: [AiAdapter],
})
export class AiModule {}
