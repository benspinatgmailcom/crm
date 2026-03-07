import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantStatus } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { FollowUpService } from './followup.service';

@Injectable()
export class FollowUpSchedulerService {
  private readonly logger = new Logger(FollowUpSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly followUpService: FollowUpService,
  ) {}

  /** Run daily at 8:00 AM (server local time). Safe to run multiple times; dedupe prevents duplicates. */
  @Cron('0 8 * * *', { name: 'followup-suggestions' })
  async runDailySuggestions(): Promise<void> {
    this.logger.log('Running daily follow-up suggestion generation');
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { status: TenantStatus.ACTIVE },
        select: { id: true },
      });
      let created = 0;
      let skipped = 0;
      let errors = 0;
      for (const { id: tenantId } of tenants) {
        try {
          const result = await this.followUpService.generateSuggestionsForOpenOpportunities(tenantId);
          created += result.created;
          skipped += result.skipped;
          errors += result.errors;
        } catch (err) {
          this.logger.warn(`Follow-up suggestions failed for tenant ${tenantId}`, err instanceof Error ? err.message : String(err));
          errors += 1;
        }
      }
      this.logger.log(
        `Follow-up suggestions: created=${created}, skipped=${skipped}, errors=${errors}`,
      );
    } catch (err) {
      this.logger.error('Follow-up suggestion generation failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
