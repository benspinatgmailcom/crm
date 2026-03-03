import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FollowUpController } from './followup.controller';
import { FollowUpSchedulerService } from './followup-scheduler.service';
import { FollowUpService } from './followup.service';

@Module({
  imports: [PrismaModule],
  controllers: [FollowUpController],
  providers: [FollowUpService, FollowUpSchedulerService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
