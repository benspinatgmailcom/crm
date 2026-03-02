/**
 * Backfill Opportunity.lastActivityAt and lastStageChangedAt from Activity.
 * Safe to run multiple times (idempotent). Run with: node dist/scripts/backfill-workflow-timestamps.js
 * Not exposed as an API endpoint.
 */
import * as path from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@crm/db';

// Load env (same order as API: packages/db then apps/api)
if (process.env.NODE_ENV !== 'production') {
  config({ path: path.resolve(process.cwd(), '../../packages/db/.env') });
  config({ path: path.resolve(process.cwd(), '.env') });
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const opportunities = await prisma.opportunity.findMany({
    select: { id: true, lastActivityAt: true, lastStageChangedAt: true },
  });

  const lastActivityByEntity = await prisma.activity.groupBy({
    by: ['entityId'],
    where: { entityType: 'opportunity', deletedAt: null },
    _max: { createdAt: true },
  });
  const lastActivityMap = new Map<string, Date>(
    lastActivityByEntity
      .filter((r) => r._max.createdAt != null)
      .map((r) => [r.entityId, r._max.createdAt!]),
  );

  const lastStageChangeByEntity = await prisma.activity.groupBy({
    by: ['entityId'],
    where: {
      entityType: 'opportunity',
      type: 'stage_change',
      deletedAt: null,
    },
    _max: { createdAt: true },
  });
  const lastStageChangeMap = new Map<string, Date>(
    lastStageChangeByEntity
      .filter((r) => r._max.createdAt != null)
      .map((r) => [r.entityId, r._max.createdAt!]),
  );

  let updated = 0;
  for (const opp of opportunities) {
    const newLastActivityAt = lastActivityMap.get(opp.id) ?? null;
    const newLastStageChangedAt = lastStageChangeMap.get(opp.id) ?? null;

    const currentLastActivityAt = opp.lastActivityAt?.getTime() ?? null;
    const currentLastStageChangedAt = opp.lastStageChangedAt?.getTime() ?? null;
    const newLastActivityAtTime = newLastActivityAt?.getTime() ?? null;
    const newLastStageChangedAtTime = newLastStageChangedAt?.getTime() ?? null;

    if (
      currentLastActivityAt !== newLastActivityAtTime ||
      currentLastStageChangedAt !== newLastStageChangedAtTime
    ) {
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          lastActivityAt: newLastActivityAt,
          lastStageChangedAt: newLastStageChangedAt,
        },
      });
      updated++;
    }
  }

  console.log('Backfill workflow timestamps:');
  console.log('  Total opportunities processed:', opportunities.length);
  console.log('  Total updated:', updated);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
