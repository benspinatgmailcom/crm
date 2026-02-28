import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { DevModule } from './dev/dev.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProbesController } from './probes/probes.controller';
import { AccountModule } from './account/account.module';
import { ContactModule } from './contact/contact.module';
import { LeadModule } from './lead/lead.module';
import { OpportunityModule } from './opportunity/opportunity.module';
import { ActivityModule } from './activity/activity.module';
import { AiModule } from './ai/ai.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { EmailModule } from './email/email.module';
import { SearchModule } from './search/search.module';
import { UsersModule } from './users/users.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SearchModule,
    AccountModule,
    ContactModule,
    LeadModule,
    OpportunityModule,
    ActivityModule,
    AiModule,
    AttachmentsModule,
    EmailModule,
    UsersModule,
    DevModule,
  ],
  controllers: [AppController, HealthController, ProbesController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}