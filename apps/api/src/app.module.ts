import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
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
    AuthModule,
    AccountModule,
    ContactModule,
    LeadModule,
    OpportunityModule,
    ActivityModule,
    ...(devOnly ? [DevModule] : []),
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
