# CRM

AI-native Customer Relationship Management - production-grade monorepo.

## Tech Stack

- **Monorepo**: pnpm + Turborepo
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS
- **Backend**: NestJS
- **Database**: Prisma + PostgreSQL
- **Shared**: Types and utilities

## Project Structure

```
apps/
  api/      # NestJS backend (port 3001)
  web/      # Next.js frontend (port 3000)
packages/
  db/       # Prisma schema and client
  shared/   # Shared utilities and types
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (for database operations)

### Install

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Development

```bash
# Run all apps in dev mode
pnpm dev

# Run individually
pnpm dev:api   # API at http://localhost:3001
pnpm dev:web   # Web at http://localhost:3000
```

### Database

1. Copy `packages/db/.env.example` to `packages/db/.env`
2. Set `DATABASE_URL` to your PostgreSQL connection string
3. Run migrations:

```bash
pnpm db:push    # Push schema (dev)
pnpm db:migrate # Apply migrations (dev; creates new ones if schema changed)
pnpm db:studio  # Prisma Studio UI
```

**Production:** apply migrations with `prisma migrate deploy` (e.g. in CI or release pipeline). See [docs/database-migrations.md](docs/database-migrations.md).

**Opportunity owner migration (`20260312000000_add_opportunity_owner`):** Adds required `ownerId` to Opportunity. Backfill assigns existing rows to the oldest active ADMIN (by createdAt), or the oldest user if no ADMIN exists. If there are no users, the migration fails with instructions to create a user (e.g. register) and re-run. Run `pnpm db:migrate` (or `prisma migrate deploy`) with `DATABASE_URL` set.

### Authentication

1. Copy `apps/api/.env.example` to `apps/api/.env` (optional, for JWT config)
2. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (required in production)
3. First user registration creates an ADMIN; subsequent registrations require ADMIN auth

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Register (first user = ADMIN, else requires ADMIN) |
| `POST /auth/login` | Login, returns access + refresh tokens |
| `POST /auth/refresh` | Exchange refresh token for new tokens |
| `POST /auth/logout` | Revoke refresh token |
| `GET /auth/me` | Current user (requires Bearer token) |

CRUD routes require JWT. Use Swagger "Authorize" with the access token.

### Attachments & storage

- **Development:** `STORAGE_DRIVER=local` (default). Files are stored under `apps/api/uploads/`. No extra env needed.
- **Production (S3):** Set `STORAGE_DRIVER=s3`, `S3_BUCKET_NAME`, and `AWS_REGION` (or `S3_REGION`). Optionally: `S3_KEY_PREFIX`, `S3_URL_EXPIRES_SECONDS` (default 3600), `S3_ENDPOINT` (S3-compatible), `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or use IAM). Bucket is not public; downloads use presigned URLs.

| Endpoint | Description |
|----------|-------------|
| `POST /attachments` | Upload (multipart: entityType, entityId, file) |
| `GET /attachments?entityType=&entityId=` | List attachments for entity |
| `GET /attachments/:id/download` | Download (redirect to signed URL for S3, or stream for local) |
| `DELETE /attachments/:id` | Delete attachment |

### OpenAI API touch points

All AI features use the **OpenAI API** via a single adapter. If `OPENAI_API_KEY` is not set, these features return 503 or an error; no requests are sent.

**Configuration (API only)**

- **`OPENAI_API_KEY`** (optional) — Set in `apps/api/.env`. Required for any AI feature.
- **`OPENAI_MODEL`** (optional) — Model name; default `gpt-4o-mini`. Used for all calls.

**Implementation**

- **Adapter:** `apps/api/src/ai/adapter/openai.adapter.ts` — Uses the OpenAI Node SDK and the **Responses API** (`client.responses.create()`). All AI calls go through the abstract `AiAdapter`; the only concrete implementation is `OpenAiAdapter`.
- **Registration:** `apps/api/src/ai/ai.module.ts` — Provides `AiAdapter` as `OpenAiAdapter`.

**Where the API is called**

| Touch point | Service / module | HTTP endpoint | Purpose |
|-------------|------------------|---------------|---------|
| **AI summary** | `AiService` (`apps/api/src/ai/ai.service.ts`) | `POST /ai/summary` | Builds entity + activity context, sends one chat request; creates `ai_summary` activity with summary text, bullets, risks, next actions, optional email draft. |
| **Next best actions** | `AiService` | `POST /ai/next-actions` | Same context pattern; one chat request; creates `ai_recommendation` activity and returns structured actions (priority, title, why, type, etc.). |
| **Draft email** | `AiService` | `POST /ai/draft-email` | Email-focused context; one chat request (plus optional retry if JSON invalid); creates `ai_email_draft` activity. `POST /ai/draft-email/:activityId/log` does **not** call OpenAI (logs draft as outbound email). |
| **Deal brief** | `AiDealBriefService` (`apps/api/src/ai/ai-deal-brief.service.ts`) | `POST /ai/deal-brief/:opportunityId` | Builds opportunity/account/contacts/activities/attachments context; one chat request; caches result in `ai_deal_brief` activity (configurable lookback, force refresh). |
| **Follow-up draft (from suggestion)** | `FollowUpDraftService` (`apps/api/src/followup-engine/draft/followup-draft.service.ts`) | `POST /followups/:suggestionId/draft` | Builds suggestion + opportunity context; one chat request (plus optional retry for JSON); creates `followup_draft_created` activity. |
| **Follow-up draft (from task)** | `FollowUpDraftService` | `POST /tasks/:taskActivityId/draft` | Same as above, triggered from an open task instead of a suggestion. |

**Summary**

- **6 user-facing flows** call OpenAI (summary, next actions, draft email, deal brief, follow-up draft from suggestion, follow-up draft from task).
- **Single abstraction:** all go through `AiAdapter.chat(messages)` → `OpenAiAdapter` → `openai.responses.create()` with `OPENAI_MODEL` and `OPENAI_API_KEY`.
- **No OpenAI calls:** logging a draft email (`/ai/draft-email/:activityId/log`) and converting a recommendation to a task (`/ai/next-actions/:activityId/convert`) only read/write DB and activities.

## Scripts

| Command       | Description                    |
|---------------|--------------------------------|
| `pnpm build`  | Build all packages             |
| `pnpm dev`    | Run all apps in dev mode       |
| `pnpm dev:api`| Run API only                   |
| `pnpm dev:web`| Run web only                   |
| `pnpm lint`   | Lint all packages              |
| `pnpm db:generate` | Generate Prisma client   |
| `pnpm db:push`    | Push schema to DB          |
| `pnpm db:migrate` | Run migrations            |
| `pnpm db:studio`  | Open Prisma Studio        |

## Updating business rules

The CRM uses configurable rules for **follow-up suggestions**, **deal health**, and **deal aging**. Change them in code as follows.

### Suggested follow-ups

- **Where:** API only.
- **Rule logic:** `apps/api/src/followup-engine/followup-engine.evaluate.ts`  
  Defines when each suggestion type fires (e.g. stale touch + no next step, overdue next step, stage stuck, critical health). Each rule has a `ruleCode`, title, description, severity, and cooldown.
- **Thresholds and cooldowns:** `apps/api/src/followup-engine/followup-engine.config.ts`  
  Tune days and cooldowns here; the evaluator reads `FOLLOWUP_ENGINE_CONFIG`.

**To change behavior:**  
1. Adjust numbers in `followup-engine.config.ts` (e.g. `STALE_TOUCH_DAYS`, `STAGE_STUCK_DAYS`, `*_COOLDOWN_DAYS`).  
2. To add or change rule text or conditions, edit `followup-engine.evaluate.ts`.  
3. Run the API test suite; follow-up engine tests live in `apps/api/src/followup-engine/`.

### Deal health scoring

- **Where:** API only.
- **Config and logic:** `apps/api/src/opportunity/health-scoring.ts`  
  `HEALTH_SCORING_CONFIG` holds all thresholds and penalties; `computeHealthScore()` produces the 0–100 score, status (healthy / warning / critical), and signals.

**To change behavior:**  
1. Edit `HEALTH_SCORING_CONFIG` in `health-scoring.ts` (e.g. `STALE_TOUCH_DAYS`, `STAGE_STUCK_DAYS`, penalty values, `HEALTHY_MIN` / `WARNING_MIN`).  
2. Optionally add or change signal logic in `computeHealthScore()`.  
3. Run tests in `apps/api/src/opportunity/` (e.g. health-scoring) to confirm.

### Forecast (win probability and forecast category)

The system computes a **close probability** (win probability, 0–100) and a **forecast category** (pipeline / best case / commit / closed) for each opportunity using a deterministic, rule-based engine.

- **Where:** API only.  
- **Config:** `apps/api/src/forecast-engine/forecast-engine.config.ts` — stage weights, category thresholds, and adjustment values.  
- **Logic:** `apps/api/src/forecast-engine/forecast-engine.evaluate.ts` — `evaluateForecast()` takes stage, amount, health score/status, days since last touch, days in stage, and next follow-up date; returns win probability, forecast category, expected revenue, and drivers (explainability).

**How close probability is determined**

1. **Base from stage** — Each stage has a base weight (e.g. prospecting 10%, qualification 20%, discovery 35%, proposal 50%, negotiation 70%). Closed-won → 100%; closed-lost → 0%. Unknown stages use the default (10%).

2. **Adjustments (add or subtract)**  
   - **Health:** score ≥ 80 → +10; score &lt; 50 → −15; score null → −5.  
   - **Staleness (days since last activity):** ≥ 14 days or null → −15; 7–13 days → −8.  
   - **Stage age (days in current stage):** ≥ 30 days or null → −12; 14–29 days → −6.  
   - **Overdue next step:** next follow-up in the past → −8.  
   - **Positive momentum:** last touch ≤ 2 days ago and health not critical → +5.

3. **Final value** — Sum of base + adjustments, clamped to 0–100 and rounded. That is the **win probability** (close probability).

**How forecast category is determined**

- **Closed-won** → category **closed**, probability 100%.  
- **Closed-lost** → category **closed**, probability 0%.  
- **Open deals:**  
  - **Commit** — win probability ≥ 75% and health status is not critical.  
  - **Best case** — win probability ≥ 45% (and not commit).  
  - **Pipeline** — win probability &lt; 45%.

**Expected revenue** = opportunity amount × (win probability / 100). Null if no amount.

**When it runs:** On opportunity create/update (unless the user overrides forecast fields), when a touch activity is recorded, and after the story seed. Values are persisted so the pipeline and dashboard can filter/display without recomputing every time.

**To change behavior:**  
1. Edit `FORECAST_ENGINE_CONFIG` in `forecast-engine.config.ts` (stage weights, thresholds, penalties, bonuses).  
2. To change category rules or add drivers, edit `forecast-engine.evaluate.ts`.  
3. Run tests in `apps/api/src/forecast-engine/` (e.g. `forecast-engine.evaluate.spec.ts`).

### Deal aging (Stale / At risk)

- **Where:** Frontend only; used for pipeline and opportunity detail badges.
- **Locations:**  
  - **Pipeline:** `apps/web/src/app/(dashboard)/opportunities/pipeline/page.tsx` — constants `STALE_LAST_TOUCH_THRESHOLD` (7), `STALE_DAYS_IN_STAGE_THRESHOLD` (14), `APPROACH_LAST_TOUCH_THRESHOLD` (5), `APPROACH_DAYS_IN_STAGE_THRESHOLD` (12), and helpers `isStale()` / `isApproachingStale()`.  
  - **Opportunity detail:** `apps/web/src/app/(dashboard)/opportunities/[id]/page.tsx` — same thresholds inlined (7, 14, 5, 12).  
  - **Account opportunity list:** `apps/web/src/app/(dashboard)/accounts/[id]/page.tsx` — same thresholds inlined.

**To change behavior:**  
1. Update the constants in `pipeline/page.tsx` (lines ~139–142).  
2. Update the inline expressions in the opportunity detail page and the account page so all three stay in sync (or refactor into a shared constant/helper to avoid drift).

**Note:** Deal aging is display-only. The API does not store “stale” or “at risk”; it only provides `daysSinceLastTouch` and `daysInStage`. The follow-up engine and health scoring use their own configs (above) for suggestions and health score.
