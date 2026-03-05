/**
 * Backfill Opportunity.winProbability, forecastCategory, expectedRevenue using the forecast engine.
 * Processes open opportunities (excludes closed-won / closed-lost).
 * Safe to run multiple times (idempotent).
 * Run after build: node dist/scripts/backfill-forecast.js
 */
import * as path from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@crm/db';
import { computeHealthScore } from '../opportunity/health-scoring';
import { evaluateForecast } from '../forecast-engine/forecast-engine.evaluate';

if (process.env.NODE_ENV !== 'production') {
  config({ path: path.resolve(process.cwd(), '../../packages/db/.env') });
  config({ path: path.resolve(process.cwd(), '.env') });
}

const prisma = new PrismaClient();

const CLOSED_STAGES = ['closed-won', 'closed-lost'];

function daysSince(date: Date | null, ref: Date): number | null {
  if (date == null) return null;
  return Math.floor((ref.getTime() - date.getTime()) / 86400000);
}

async function main(): Promise<void> {
  const opportunities = await prisma.opportunity.findMany({
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

  const now = new Date();
  let updated = 0;

  for (const o of opportunities) {
    const stage = o.stage ?? 'prospecting';
    if (CLOSED_STAGES.includes(stage)) {
      continue;
    }

    const daysSinceLastTouch = daysSince(o.lastActivityAt, now);
    const daysInStage = daysSince(o.lastStageChangedAt, now);
    const health = computeHealthScore({
      stage: o.stage,
      daysSinceLastTouch,
      daysInStage,
      nextFollowUpAt: o.nextFollowUpAt,
      now,
    });

    const amountNum = o.amount != null ? Number(o.amount.toString()) : null;
    const forecast = evaluateForecast(
      {
        stage,
        amount: amountNum,
        closeDate: o.closeDate,
        daysSinceLastTouch,
        daysInStage,
        healthScore: health.healthScore,
        healthStatus: health.healthStatus,
        healthSignals: health.healthSignals,
        nextFollowUpAt: o.nextFollowUpAt,
      },
      now,
    );

    await prisma.opportunity.update({
      where: { id: o.id },
      data: {
        winProbability: forecast.winProbability,
        forecastCategory: forecast.forecastCategory,
        expectedRevenue: forecast.expectedRevenue != null ? forecast.expectedRevenue : null,
      },
    });
    updated++;
  }

  console.log('Backfill forecast:');
  console.log('  Total opportunities:', opportunities.length);
  console.log('  Open opportunities updated:', updated);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
