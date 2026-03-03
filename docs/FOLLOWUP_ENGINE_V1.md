# Auto Follow-Up Task Engine v1 — Implementation Summary

## New files

| Path | Purpose |
|------|--------|
| `apps/api/src/followup-engine/followup-engine.config.ts` | Rule thresholds and constants |
| `apps/api/src/followup-engine/followup-engine.time.ts` | Time helpers (tomorrow 9am, today 5pm, within 2 days 9am) |
| `apps/api/src/followup-engine/followup-engine.types.ts` | `SuggestionSpec`, `FollowUpEngineInput` |
| `apps/api/src/followup-engine/followup-engine.evaluate.ts` | Pure `evaluateOpportunityForFollowups()` |
| `apps/api/src/followup-engine/followup-engine.evaluate.spec.ts` | Unit tests for evaluator + time helpers |
| `apps/api/src/followup-engine/followup-metadata.types.ts` | Activity metadata types (suggestion, task, state change) |
| `apps/api/src/followup-engine/followup.service.ts` | FollowUpService: generate, list, createTask, complete/dismiss/snooze |
| `apps/api/src/followup-engine/followup.service.spec.ts` | Service tests (list, createTask, complete, dedupe behavior) |
| `apps/api/src/followup-engine/followup.controller.ts` | POST followups/:id/create-task, tasks/:id/complete, dismiss, snooze |
| `apps/api/src/followup-engine/followup.module.ts` | FollowUpModule |
| `apps/api/src/followup-engine/followup-scheduler.service.ts` | Cron daily 8am: `generateSuggestionsForOpenOpportunities()` |
| `apps/api/src/followup-engine/dto/snooze-task.dto.ts` | Body `{ until: ISO string }` for snooze |
| `apps/api/src/followup-engine/index.ts` | Re-exports for engine (evaluate, config, time, types) |

## Modified files (summary)

- **apps/api/package.json** — Added `@nestjs/schedule`.
- **apps/api/src/app.module.ts** — `ScheduleModule.forRoot()`, `FollowUpModule` in imports.
- **apps/api/src/opportunity/opportunity.module.ts** — Import `FollowUpModule`.
- **apps/api/src/opportunity/opportunity.controller.ts** — Injected `FollowUpService`; added `GET :id/followups` (before `GET :id`) returning `listOpportunityFollowups(id)`.
- **apps/web/src/app/(dashboard)/opportunities/[id]/page.tsx** — Follow-ups section: fetch `GET /opportunities/:id/followups`, render suggestions (title, description, due, severity, reason codes, “Create task”) and open tasks (due, Complete / Dismiss / Snooze); API calls for create-task, complete, dismiss, snooze.

## Data model (no new Prisma model)

- **Activity** only: `entityType` = `"opportunity"`, `entityId` = opportunity id, `type` and `metadata` as below.
- **Suggestion:** `type = "followup_suggested"`, `metadata`: ruleCode, title, description, suggestedDueAt, severity, dedupeKey, cooldownDays, reasonCodes, status `"SUGGESTED"`.
- **Task:** `type = "task_created"`, `metadata`: ruleCode, title, description, dueAt, priority, status `"OPEN"`, dedupeKey, createdFromSuggestionActivityId (optional).
- **State changes:** `type = "task_completed" | "task_dismissed" | "task_snoozed"`, `metadata`: taskActivityId, status, snoozedUntil (for snooze).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /opportunities/:id/followups | List suggestions + open tasks (lazy-loaded on detail) |
| POST | /followups/:suggestionId/create-task | Create task from suggestion |
| POST | /tasks/:taskActivityId/complete | Mark task completed |
| POST | /tasks/:taskActivityId/dismiss | Dismiss task |
| POST | /tasks/:taskActivityId/snooze | Body `{ until: ISO string }` |
| POST | /followups/generate | **Admin only.** Manually run suggestion generation. Returns `{ created, skipped, errors }`. |

## How to run tests

```bash
cd apps/api
pnpm test followup
```

Runs:

- `followup-engine.evaluate.spec.ts` — All four rules, severity boundaries, due-date helpers, dedupeKey.
- `followup.service.spec.ts` — listOpportunityFollowups (suggestions vs open task, completed excluded), createTaskFromSuggestion (success + 404/400), completeTask (creates activity).

## How to run the scheduler locally

- The scheduler is registered when the API runs: `FollowUpSchedulerService` uses `@Cron('0 8 * * *')` (daily 8:00 AM server local time).
- **Run API:** `cd apps/api && pnpm dev`. The cron will run once per day at 8am in the server’s timezone. **Run follow-up generation manually:** Call `POST /followups/generate` with an admin JWT. Example:

```bash
curl -X POST "http://localhost:3000/followups/generate" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

Response: `{ "created", "skipped", "errors" }`. Get a JWT via `POST /auth/login` as an admin user.

## Performance and v2 notes

- **v1:** One bulk query for open opportunities; one bulk query for followup/task activities by opportunity IDs (no N+1). Dedupe and cooldown are in-memory after fetch. Safe to run the job multiple times (dedupe prevents duplicate suggestions).
- **v2:** Optional pipeline summary: add counts of suggestions/open tasks to the pipeline response to show “Suggested: …” / “Next: …” on Kanban without extra round-trips. Consider timezone per user/org for “9am local”. Consider indexing `(entityType, entityId, type)` and JSON path on `metadata->>'dedupeKey'` if filtering by dedupeKey in DB becomes necessary at scale.
