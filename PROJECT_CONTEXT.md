# Project: Bespoke CRM

## Vision

AI-native deal intelligence platform for modern sales workflows. Not just a CRUD CRM — focused on pipeline clarity, automation, and AI insight.

Ultimately, this will be part of a project called **Bespoke CRM**: a complete but generic, modern, lightweight CRM with an API-backed and AI-native architecture that can be inexpensively deployed in the public cloud. Using this as a starting point, the CRM can be cloned and customized for specific client organizations. Customizations will be developed efficiently using “vibe coding.” Clients get a simple, scalable, AI-native CRM tailored to their requirements, at lower cost and more open than SaaS CRMs such as Salesforce.

---

## Current Phase

**Multi-tenant support**

---

## Stack

### Monorepo

- **Tooling:** pnpm 9+, Turborepo, Node 20+
- **Root:** `package.json` — scripts: `build`, `dev`, `dev:api`, `dev:web`, `lint`, `db:generate`, `db:push`, `db:migrate`, `db:studio`, `db:seed`

### Frontend (`apps/web`)

- Next.js 15 (App Router)
- Tailwind CSS
- DnD Kit (pipeline drag/drop)
- react-big-calendar + date-fns (Calendar)
- JWT auth (access + refresh, stored in memory/cookies)
- Env-driven theming: accent colors, logo, favicon, manifest
- Port: 3000

### Backend (`apps/api`)

- NestJS
- Prisma ORM
- PostgreSQL (via `packages/db`)
- OpenAI Node SDK — **Responses API** (`client.responses.create()`), single adapter in `apps/api/src/ai/adapter/openai.adapter.ts`
- Role-based auth: **ADMIN**, **USER**, **VIEWER**
- Port: 3001

### Packages

- **`packages/db`** — Prisma schema, migrations, seed, `@crm/db` client
- **`packages/shared`** — Shared utilities and types (`@crm/shared`)

### Storage

- **Development:** `STORAGE_DRIVER=local` — files under `apps/api/uploads/`
- **Production:** `STORAGE_DRIVER=s3` — S3 (or R2/Vercel Blob–compatible) with presigned download URLs

---

## Core Data Model (Prisma)

| Model | Purpose |
|-------|---------|
| **Account** | Company; optional `industry`, `website`; can be created from Lead (sourceLeadId). |
| **Contact** | Person; belongs to Account; optional `phone`; can be created from Lead. |
| **Lead** | Inbound lead; `name`, `email`, `company`, `status`; conversion creates Account, Contact, Opportunity, and initial Task. |
| **Opportunity** | Deal; belongs to Account and **owner** (User); `name`, `amount`, `stage`, `closeDate`; `lastActivityAt`, `lastStageChangedAt`, `nextFollowUpAt`; `healthScore`, `healthSignals`; `winProbability`, `forecastCategory`, `expectedRevenue`. |
| **OpportunityContact** | Buying team: links Opportunity ↔ Contact with `role` (e.g. Champion, Economic Buyer, Technical Stakeholder). |
| **Activity** | Event/audit; polymorphic `entityType` + `entityId`; `type` (note, call, meeting, email, task, ai_summary, ai_deal_brief, ai_recommendation, ai_email_draft, stage_change, followup_suggested, task_created, task_completed, task_dismissed, task_snoozed, followup_draft_created, followup_sent, file_uploaded, etc.); `payload` + optional `metadata`; soft delete via `deletedAt`. |
| **Attachment** | File; polymorphic `entityType` + `entityId`; `fileName`, `mimeType`, `size`, `storageKey`, `storageDriver`, `bucket`; optional `extractedText`; `uploadedByUserId`. |
| **User** | Email, password hash, `role`, `isActive`, `mustChangePassword`. |
| **RefreshToken** | JWT refresh token storage (revocable). |
| **PasswordResetToken** | For forgot-password / set-password flow. |

---

## Architecture Conventions

- **Activities** are the event/audit layer; AI features and workflows create Activity records.
- **Opportunity** is the primary object after lead conversion; pipeline and forecast revolve around it.
- **Stage changes** create `stage_change` activities (with optional `lostReason` / `lostNotes` for closed-lost).
- **Lead conversion** creates Account, Contact, Opportunity, and an initial Task activity.
- **Inline pipeline edits** PATCH the Opportunity directly (stage, etc.).
- **Deal health**, **forecast** (win probability, category, expected revenue), and **follow-up suggestions** are computed in the API; deal aging (stale/at-risk badges) is computed on the frontend for display only.
- **OpenAI** is used only via the single `AiAdapter` implementation (`OpenAiAdapter`); all AI flows call `AiAdapter.chat(messages)`.

---

## Code Structure

```
apps/
  api/                    # NestJS backend (port 3001)
    src/
      auth/               # Register, login, refresh, logout, forgot/reset/change password
      users/              # User CRUD, reset-password (admin)
      account/
      contact/
      lead/               # + POST :id/convert
      opportunity/        # CRUD, pipeline, followups, deal-team
      activity/
      attachments/        # Upload, list, download, delete
      ai/                 # Summary, next-actions, draft-email, deal-brief; adapter (OpenAI)
      followup-engine/     # Follow-up suggestions, drafts (AI), tasks (complete/dismiss/snooze)
      tasks/              # List/query tasks, PATCH status
      dashboard/          # Pipeline health
      search/             # Global search
      health/             # Health + DB check
      metabase/           # Dashboard embed URL
      dev/                # Seed, seed-story (dev only)
      probes/             # healthz, readyz
      config/             # env validation (zod)
      common/             # Guards, filters, middleware
  web/                    # Next.js frontend (port 3000)
    src/
      app/
        (dashboard)/      # Protected layout + nav
          accounts/       # List, [id] detail
          contacts/       # List, [id] detail
          leads/           # List, [id] detail + convert
          opportunities/   # List, [id] detail, pipeline (Kanban)
          tasks/          # Task list (filters, assignee, related entity)
          followups/      # Follow-up list (filters, actions)
          calendar/       # Month/week view (tasks + follow-ups)
          reports/        # Reports placeholder
          settings/users/ # User management (admin)
          health/         # Health check page
          dev/            # Dev seed (dev only)
        login/
        forgot-password/
        set-password/
        change-password/
      components/         # UI, entity forms, activity timeline, attachments, AI modals
      context/           # Auth
      lib/               # API client, roles, theme
packages/
  db/                     # Prisma schema, migrations, seed
  shared/                 # Shared utils and types
docs/
  database-migrations.md
  FOLLOWUP_ENGINE_V1.md
```

---

## API Surface (Summary)

### Auth (`/auth`)

- `POST register`, `POST login`, `POST refresh`, `POST logout`
- `POST forgot-password`, `POST reset-password`, `GET me`, `POST change-password`

### Core CRUD

- **Accounts** — `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id`
- **Contacts** — `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id`
- **Leads** — `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id`, `POST :id/convert`
- **Opportunities** — `POST`, `GET` (query), `GET pipeline`, `GET :id`, `GET :id/followups`, `GET :id/deal-team`, `POST :id/deal-team`, `PATCH :id/deal-team/:contactId`, `DELETE :id/deal-team/:contactId`, `PATCH :id`, `DELETE :id`
- **Activities** — `POST`, `GET` (by entity), `GET :id`, `PATCH :id`, `DELETE :id`
- **Attachments** — `POST` (multipart), `GET` (query), `GET :id/download`, `DELETE :id`

### AI (`/ai`)

- `POST summary` — AI summary for entity → `ai_summary` activity
- `POST next-actions` — Next best actions → `ai_recommendation` activity
- `POST next-actions/:activityId/convert` — Convert one action to task (no OpenAI)
- `POST draft-email` — AI draft email → `ai_email_draft` activity
- `POST draft-email/:activityId/log` — Log draft as outbound email (no OpenAI)
- `POST deal-brief/:opportunityId` — Deal brief (cached) → `ai_deal_brief` activity

### Follow-ups & tasks (root routes)

- `GET followups` — List follow-up suggestions (query)
- `POST followups/generate` — Generate suggestions for open opportunities
- `POST followups/:suggestionId/draft` — AI follow-up draft from suggestion
- `POST followups/:suggestionId/create-task` — Create task from suggestion
- `POST tasks/:taskActivityId/draft` — AI follow-up draft from task
- `POST tasks/:taskActivityId/complete`, `.../dismiss`, `.../snooze`
- `POST drafts/:draftActivityId/mark-sent` — Mark draft as sent

### Tenant isolation (API) — checklist

All reads are scoped by `req.user.tenantId`; creates inject it; updates/deletes require both `id` and `tenantId`. Client-supplied `tenantId` is never trusted for these routes. RBAC unchanged.

| Area | Endpoints | Status |
|------|-----------|--------|
| **Users** | `GET`, `GET :id`, `POST`, `PATCH :id`, `POST :id/reset-password` | ✅ Tenant-scoped when `user.tenantId` set; global admin (`tenantId === null`) can list/update any user |
| **Accounts** | `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id` | ✅ Full tenant isolation |
| **Contacts** | `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id` | ✅ Full tenant isolation; create validates account in tenant |
| **Leads** | `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id`, `POST :id/convert` | ✅ Full tenant isolation; convert creates account/contact/opportunity/activities with same tenantId |
| **Opportunities** | `POST`, `GET`, `GET pipeline`, `GET :id`, `PATCH :id`, `DELETE :id`, deal-team CRUD | ✅ Full tenant isolation |
| **Activities** | `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id` | ✅ Full tenant isolation |
| **Attachments** | `POST`, `GET`, `GET :id/download`, `DELETE :id` | ✅ Full tenant isolation; entity validation and createRaw use tenantId |
| **Upload** (legacy) | `POST uploads`, `GET uploads/download` | ✅ `createRaw` now receives tenantId from `requireTenantId(user)` |
| **AI** | summary, next-actions, draft-email, deal-brief, convert/log/sent | ✅ All flows take tenantId from controller; createRaw and context builders tenant-scoped |
| **Follow-ups** | `GET followups`, `GET opportunities/:id/followups` | ✅ `listAllFollowups` and `listOpportunityFollowups` take tenantId; opportunity/activity queries scoped |
| **Search** | `GET /search` | ✅ Tenant-scoped; controller `requireTenantId`, service adds `tenantId` to all account/contact/lead/opportunity findMany |
| **Tasks** | `GET /tasks`, `PATCH /tasks/:id` | ✅ Tenant-scoped; opportunity/activity/lead/account/contact queries and task update use `tenantId` |
| **Follow-up engine** | `POST followups/generate`, draft, create-task, complete/dismiss/snooze, mark-sent | ✅ Generate/list/draft/task/complete/dismiss/snooze/mark-sent all take `tenantId`; activity creates and lookups scoped; draft context builder and WorkflowService.updateLastActivityAt tenant-scoped |
| **Dashboard** | `GET /dashboard/pipeline-health` | ✅ Controller `requireTenantId`; opportunity and activity findMany include `tenantId` |
| **AI summary** | `POST /ai/summary` | ✅ Controller now passes `tenantId` to service (was missing) |
| **Attachments delete** | `DELETE /attachments/:id` | ✅ Uses `deleteMany({ where: { id, tenantId } })` after load by tenant |

**Hardening pass (tenant-isolation) — endpoints reviewed**

- **Global search** — `GET /search`: controller + service tenant-scoped.
- **Tasks** — `GET /tasks`, `PATCH /tasks/:id`: findAll/update take `tenantId`; all opportunity/activity/lead/account/contact queries scoped.
- **Followups** — `GET followups`, `GET opportunities/:id/followups`, `POST followups/generate`, `POST followups/:suggestionId/draft`, `POST followups/:suggestionId/create-task`, `POST tasks/:taskActivityId/draft`, `POST tasks/:taskActivityId/complete`, `dismiss`, `snooze`, `POST drafts/:draftActivityId/mark-sent`: all require tenant and pass `tenantId` into service; generateSuggestionsForOpenOpportunities, createTaskFromSuggestion, complete/dismiss/snooze, draft buildFromSuggestion/buildFromTask, markDraftSent, and WorkflowService.updateLastActivityAt updated.
- **Dashboard** — `GET /dashboard/pipeline-health`: getPipelineHealth(user, query, tenantId); opportunity and activity findMany scoped.
- **AI** — summary (controller now passes tenantId), next-actions, draft-email, deal-brief, convert/log: already tenant-scoped; summary fix only.
- **Attachments** — list/download/delete: already tenant-scoped; delete hardened with `deleteMany({ id, tenantId })`.
- **Calendar** — No dedicated calendar API; task/followup list endpoints used by calendar are tenant-scoped.

**Endpoints that remain risky or need manual QA**

- **OpportunityForecastService.recomputeForecast(opportunityId)** — Called from activity and opportunity services with an id that is already in-context; no `tenantId` parameter. Low risk but could be hardened with tenantId and findFirst(where: { id, tenantId }) for defense in depth.
- **Dev** — `POST /dev/seed`, `POST /dev/seed-story`: not tenant-scoped; optional for dev-only.
- **Metabase** — `GET /metabase/dashboard-embed-url`: tenant-aware if required by deployment.

**Suggested test cases for cross-tenant leakage prevention**

1. **Search** — As user in tenant A, call `GET /search?q=acme`; assert no results from tenant B (e.g. seed tenant A and B each with an “Acme” account; expect only A’s).
2. **Tasks** — As user in tenant A, call `GET /tasks` and `PATCH /tasks/:id` with a task id from tenant B; list must exclude B’s tasks; PATCH must 404.
3. **Followups** — As user in tenant A, call `GET /followups`, `GET /opportunities/:id/followups` with B’s opportunity id, `POST followups/:suggestionId/create-task` with B’s suggestion id, `POST tasks/:id/complete` with B’s task id; expect 404 or empty list for B’s data.
4. **Pipeline health** — As user in tenant A, call `GET /dashboard/pipeline-health`; assert queue and summary only include opportunities (and activities) for tenant A.
5. **AI** — As user in tenant A, call `POST /ai/summary`, `POST /ai/next-actions`, `POST /ai/draft-email`, `POST /ai/deal-brief/:id` with an entity id from tenant B; expect 404 for entity not in tenant.
6. **Attachments** — As user in tenant A, call `GET /attachments`, `GET /attachments/:id/download`, `DELETE /attachments/:id` for an attachment in tenant B; expect 404 or empty list.
7. **E2E** — Create two tenants with same-named entities; log in as user in tenant 1, run search/list/detail for each resource type; assert no tenant 2 data appears.

### Tasks (`/tasks`)

- `GET` — List tasks (query, assignee, etc.)
- `PATCH :id` — Update task (e.g. status, due date)

### Other

- **Search** — `GET /search?q=`
- **Dashboard** — `GET /dashboard/pipeline-health`
- **Health** — `GET /health`, `GET /health/db`
- **Probes** — `GET /healthz`, `GET /readyz`
- **Metabase** — `GET /metabase/dashboard-embed-url`
- **Users** — `GET /users/active`, `GET /users`, `POST`, `PATCH :id`, `POST :id/reset-password`
- **Dev** — `POST /dev/seed`, `POST /dev/seed-story`

---

## Implemented Features

### CRM essentials

- Entity detail pages (Account, Contact, Lead, Opportunity) with dedicated routes
- Global search
- Quick create (opportunity, account, contact, lead)
- Opportunity Kanban (pipeline) with drag-and-drop, filters, inline edit, stage-change reason modal
- Pipeline totals and weighted forecast
- Lead conversion workflow (Account + Contact + Opportunity + Task)
- Attachment upload/list/download/delete per entity
- Activity timeline per entity (filter by type, pagination, AI summary/draft/next-actions from UI)
- Buying team (OpportunityContact) on opportunity

### AI features

- AI summary (entity + activities → summary, bullets, risks, next actions)
- Next best actions (structured list; convert single action to task)
- AI draft email (intent, tone, length; log as sent)
- AI deal brief (opportunity; cached, force-refresh option)
- Follow-up draft from suggestion or from task (email/call/LinkedIn; tone, length, CTA)

### Workflow & intelligence

- Follow-up suggestions (engine: stale touch, overdue next step, stage stuck, critical health; cooldowns)
- Follow-ups page (list, assignee/opportunity filters, create task, generate draft)
- Tasks page (list, assignee/related filters, priority pills, edit)
- Calendar (month/week; tasks and follow-ups; filters: assignee, type, only open)
- Deal health scoring (API; 0–100, healthy/warning/critical, signals)
- Forecast engine (win probability, forecast category, expected revenue; persisted on opportunity)
- Deal aging (frontend: stale/at-risk badges on pipeline and opportunity detail)

### Admin & ops

- User management (create, role update, deactivate, reset password)
- RBAC (ADMIN, USER, VIEWER) enforced on API and nav
- Password reset via email (Resend)
- Health check page and API health/db probes
- Metabase dashboard embed (reports)

### Branding & UX

- Env-driven accent colors and logo
- Dark header theme
- Favicon and manifest
- Icons on opportunity page cards (Deal Brief, Follow-ups, Buying Team, Sales process, etc.)

---

## Business Rules (Config in Code)

- **Follow-up engine** — `apps/api/src/followup-engine/followup-engine.config.ts` (thresholds, cooldowns), `followup-engine.evaluate.ts` (rules).
- **Deal health** — `apps/api/src/opportunity/health-scoring.ts` (`HEALTH_SCORING_CONFIG`, `computeHealthScore()`).
- **Forecast** — `apps/api/src/forecast-engine/forecast-engine.config.ts`, `forecast-engine.evaluate.ts` (stage weights, category thresholds, adjustments).
- **Deal aging (UI)** — `apps/web/.../pipeline/page.tsx` constants; same thresholds inlined on opportunity detail and account opportunity list. See README “Updating business rules.”

---

## Pipeline Stages (Opportunity)

Ordered list used by pipeline and forecast:

`prospecting` → `qualification` → `discovery` → `proposal` → `negotiation` → `closed-won` | `closed-lost`

---

## Production Deployment Architecture

### Environment topology

```
Browser
   ↓
Next.js (React UI; Vercel)
   ↓
NestJS Backend (REST; Render Docker)
   ↓
PostgreSQL (Prisma ORM; Neon)
   ↓
External: OpenAI, Resend (email), S3 (blob), Metabase (analytics)
```

### Web (frontend)

- **Platform:** Vercel
- **Root:** `apps/web`
- **Env:** `NEXT_PUBLIC_API_URL` → backend API URL

### API (backend)

- **Platform:** Render (Docker Web Service)
- **Runtime:** Node 22
- **Env:** JWT secrets, `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, storage (S3), Resend, Metabase embed, etc.

### Database

- PostgreSQL; Prisma ORM; hosted on Neon

### Email

- Resend

### Blob storage

- AWS S3 (or S3-compatible)

### Analytics

- Metabase

---

## Roadmap

### Phase 1 – Production readiness

- Deploy web + API ✅
- Managed Postgres ✅
- Blob storage ✅
- Env validation
- AI rate limiting
- Logging & monitoring
- Backups
- Password reset via email ✅
- Audit log
- Metabase for reports/dashboards ✅

### Phase 2 – Workflow intelligence

- Deal aging detection ✅
- Pipeline health dashboard ✅
- Stage probability editing ✅
- Win/loss reporting
- Auto follow-up tasks
- Notifications

### Phase 3 – AI differentiation

- AI deal brief ✅
- Risk scoring
- Relationship mapping
- Auto meeting ingestion
- Long-term account memory

### Phase 4 – Collaboration

- Mentions
- Comments
- Slack/email integration
- Calendar sync

### Phase 5 – Commercialization

- Multi-tenant support
- Billing tiers
- AI usage metering
- Public API

---

## Observability (optional Sentry)

Env vars for future Sentry integration (no vendor required until configured):

**API (NestJS)**  
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`

**Web (Next.js)**  
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`
