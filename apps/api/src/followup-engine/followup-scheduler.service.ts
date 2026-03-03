import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FollowUpService } from './followup.service';

@Injectable()
export class FollowUpSchedulerService {
  private readonly logger = new Logger(FollowUpSchedulerService.name);

  constructor(private readonly followUpService: FollowUpService) {}

  /** Run daily at 8:00 AM (server local time). Safe to run multiple times; dedupe prevents duplicates. */
  @Cron('0 8 * * *', { name: 'followup-suggestions' })
  async runDailySuggestions(): Promise<void> {
    this.logger.log('Running daily follow-up suggestion generation');
    try {
      const result = await this.followUpService.generateSuggestionsForOpenOpportunities();
      this.logger.log(
        `Follow-up suggestions: created=${result.created}, skipped=${result.skipped}, errors=${result.errors}`,
      );
    } catch (err) {
      this.logger.error('Follow-up suggestion generation failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
