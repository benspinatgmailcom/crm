import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { AiModule } from '../ai/ai.module';
import { FollowUpController } from './followup.controller';
import { FollowUpSchedulerService } from './followup-scheduler.service';
import { FollowUpService } from './followup.service';
import { DraftContextBuilder } from './draft/draft-context.builder';
import { FollowUpDraftService } from './draft/followup-draft.service';

@Module({
  imports: [PrismaModule, WorkflowModule, AiModule],
  controllers: [FollowUpController],
  providers: [FollowUpService, FollowUpSchedulerService, DraftContextBuilder, FollowUpDraftService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
