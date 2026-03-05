# Forecast Engine v1

Win probability and forecast category (pipeline | best_case | commit | closed) per opportunity, with expected revenue and explainable drivers.

## Tests

From repo root or `apps/api`:

```bash
pnpm test forecast-engine.evaluate.spec
pnpm test opportunity-forecast.service.spec
```

## Backfill script

After applying the migration that adds `winProbability`, `forecastCategory`, and `expectedRevenue`:

1. Build the API: `pnpm build` (from `apps/api` or monorepo root).
2. Run the backfill: `pnpm run script:backfill-forecast` from `apps/api`.

This computes and stores forecast values for all **open** opportunities (skips closed-won / closed-lost). Safe to run multiple times.

## Migration

- **Name:** `20260313000000_add_forecast_fields`
- **Location:** `packages/db/prisma/migrations/20260313000000_add_forecast_fields/migration.sql`
- **Contents:** Adds `winProbability` (Int), `forecastCategory` (String), `expectedRevenue` (Decimal), and indexes on `forecastCategory` and `(ownerId, forecastCategory)`.

Apply with: `pnpm prisma migrate deploy` (from `packages/db`) or your usual migration workflow.
