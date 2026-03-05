import { Module } from '@nestjs/common';
import { ForecastModule } from '../forecast-engine/forecast.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [WorkflowModule, ForecastModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
