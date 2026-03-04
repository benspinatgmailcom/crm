import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PipelineHealthController } from './pipeline-health.controller';
import { PipelineHealthService } from './pipeline-health.service';

@Module({
  imports: [PrismaModule],
  controllers: [PipelineHealthController],
  providers: [PipelineHealthService],
  exports: [PipelineHealthService],
})
export class DashboardModule {}
