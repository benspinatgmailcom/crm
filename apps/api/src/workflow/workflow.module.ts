import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [PrismaModule],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
