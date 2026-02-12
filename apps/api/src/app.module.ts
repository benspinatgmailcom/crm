import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DevModule } from './dev/dev.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AccountModule } from './account/account.module';
import { ContactModule } from './contact/contact.module';
import { LeadModule } from './lead/lead.module';
import { OpportunityModule } from './opportunity/opportunity.module';
import { ActivityModule } from './activity/activity.module';

const devOnly = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    PrismaModule,
    AccountModule,
    ContactModule,
    LeadModule,
    OpportunityModule,
    ActivityModule,
    ...(devOnly ? [DevModule] : []),
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
