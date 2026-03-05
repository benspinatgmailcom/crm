import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeHealthScore } from '../opportunity/health-scoring';
import { evaluateForecast } from './forecast-engine.evaluate';

@Injectable()
export class OpportunityForecastService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load opportunity, compute health + forecast, persist winProbability, forecastCategory, expectedRevenue.
   */
  async recomputeForecast(opportunityId: string): Promise<void> {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        stage: true,
        amount: true,
        closeDate: true,
        lastActivityAt: true,
        lastStageChangedAt: true,
        nextFollowUpAt: true,
      },
    });
    if (!opp) throw new NotFoundException(`Opportunity ${opportunityId} not found`);

    const now = new Date();
    const daysSinceLastTouch = this.daysSince(opp.lastActivityAt, now);
    const daysInStage = this.daysSince(opp.lastStageChangedAt, now);
    const health = computeHealthScore({
      stage: opp.stage,
      daysSinceLastTouch,
      daysInStage,
      nextFollowUpAt: opp.nextFollowUpAt,
      now,
    });

    const amountNum = opp.amount != null ? Number(opp.amount.toString()) : null;
    const forecast = evaluateForecast(
      {
        stage: opp.stage ?? 'prospecting',
        amount: amountNum,
        closeDate: opp.closeDate,
        daysSinceLastTouch,
        daysInStage,
        healthScore: health.healthScore,
        healthStatus: health.healthStatus,
        healthSignals: health.healthSignals,
        nextFollowUpAt: opp.nextFollowUpAt,
      },
      now,
    );

    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        winProbability: forecast.winProbability,
        forecastCategory: forecast.forecastCategory,
        expectedRevenue: forecast.expectedRevenue != null ? forecast.expectedRevenue : null,
      },
    });
  }

  private daysSince(date: Date | null, ref: Date): number | null {
    if (date == null) return null;
    return Math.floor((ref.getTime() - date.getTime()) / 86400000);
  }
}
