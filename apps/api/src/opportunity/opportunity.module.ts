import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { FollowUpModule } from '../followup-engine/followup.module';
import { ForecastModule } from '../forecast-engine/forecast.module';
import { OpportunityController } from './opportunity.controller';
import { OpportunityService } from './opportunity.service';

@Module({
  imports: [ActivityModule, FollowUpModule, ForecastModule],
  controllers: [OpportunityController],
  providers: [OpportunityService],
  exports: [OpportunityService],
})
export class OpportunityModule {}
