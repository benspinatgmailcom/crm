import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpportunityForecastService } from './opportunity-forecast.service';

@Module({
  imports: [PrismaModule],
  providers: [OpportunityForecastService],
  exports: [OpportunityForecastService],
})
export class ForecastModule {}
