# Development Iteration Procedure (Local → Staging → Production)

This procedure assumes a typical iteration may include:
- App/UI changes (`apps/web`)
- API changes (`apps/api`)
- Database schema changes (`packages/db/prisma/schema.prisma`)
- New/changed endpoints and migrations

---

## 0) Branching & Environment Assumptions

- Work happens on feature branches (PRs into `main`)
- Web deploys on Vercel
- API deploys on Render (Docker)
- DB is Neon (staging + production)
- Storage is R2 (staging + production)

Recommended environments:
- **Local** → local DB or Neon dev branch
- **Staging** → Render staging service + Neon staging DB + Vercel preview (or staging project)
- **Production** → Render prod service + Neon prod DB + Vercel production

---

## 1) Local Development Workflow (Day-to-Day)

### 1.1 Start Local Services
From repo root:

- Start DB (if local): Postgres via Docker or local install
- Start API:
  - `pnpm --filter @crm/api dev`
- Start Web:
  - `pnpm --filter @crm/web dev`

### 1.2 Code Changes
- Web changes: `apps/web/**`
- API changes: `apps/api/**`
- Shared types/utilities: `packages/shared/**`

---

## 2) Database Schema Change Workflow (Prisma)

### 2.1 Edit Prisma Schema
File:
- `packages/db/prisma/schema.prisma`

### 2.2 Create a Migration (Local)
From repo root (use your local DB or a dev Neon DB URL):
- Ensure `DATABASE_URL` points to your dev database

Run:
- `pnpm -w exec prisma migrate dev --schema="packages/db/prisma/schema.prisma" --name "<short_migration_name>"`

This will:
- generate a new migration under `packages/db/prisma/migrations/*`
- update Prisma client (if configured)
- apply changes to the dev DB

### 2.3 Regenerate Prisma Client (if needed)
If your workflow doesn’t auto-generate:
- `pnpm -w exec prisma generate --schema="packages/db/prisma/schema.prisma"`

### 2.4 Update API Code to Match Schema
- Update Prisma queries in API
- Update DTOs and validations as needed
- Update any seed logic if required

### 2.5 Commit Migration Artifacts
Always commit:
- `packages/db/prisma/migrations/**`
- any schema/client changes required by the repo structure

Never commit local-only DB artifacts.

---

## 3) Local Verification Checklist (Before PR)

### 3.1 Unit/Build Checks
- Web:
  - `pnpm --filter @crm/web build`
- API:
  - `pnpm --filter @crm/api build`

### 3.2 Smoke Tests (Local)
- login works
- pipeline loads
- create/update entities works
- stage drag/drop works
- key API endpoints respond
- attachments (if enabled locally) work

### 3.3 DB Migration Sanity
- Start from a clean dev DB (optional but recommended) and re-run:
  - `prisma migrate deploy` (to confirm migrations apply cleanly)
  - `prisma db seed` (to confirm seed works)

---

## 4) PR / Merge Procedure

### 4.1 Open PR
Include in PR description:
- what changed (web/api/schema)
- whether a migration was added
- any new env vars required

### 4.2 Required Files in PR (if schema changed)
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/**`
- any API code changes needed for compatibility

---

## 5) Staging Deployment Procedure (Recommended Gate)

### 5.1 Ensure Staging Env Vars Are Set
Render (staging API service):
- `DATABASE_URL` (Neon staging)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `OPENAI_API_KEY` (staging key if you use one)
- storage keys (R2 staging)
- any new required variables

Vercel (preview or staging web):
- `NEXT_PUBLIC_API_URL` → staging Render API URL

### 5.2 Deploy to Staging
- Merge to `main` or deploy from a staging branch depending on your workflow
- Render builds Docker and runs:
  - `pnpm --filter @crm/api start:prod:migrate`
  - which runs `prisma migrate deploy` automatically on boot

### 5.3 Verify Staging Health
- API:
  - `GET /healthz` returns `{"status":"ok"}`
  - `GET /readyz` returns `{"status":"ok","db":"ok"}`
- Web:
  - login page loads
  - can log in
  - can load pipeline

### 5.4 Seed Staging DB (If Needed)
If staging DB is new/empty:
- Set staging DATABASE_URL locally (must match Render staging)
- Run:
  - `pnpm -w exec prisma migrate deploy --schema="packages/db/prisma/schema.prisma"`
  - `pnpm -w exec prisma db seed --schema="packages/db/prisma/schema.prisma"`

Seed supports bootstrap admin via:
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_ROLE`

---

## 6) Production Deployment Procedure

### 6.1 Pre-Deploy Checklist
- Staging validated (login + core flows)
- Migration applies cleanly on staging
- No new required env vars missing in production
- Seed is NOT run on production unless explicitly intended

### 6.2 Deploy
- Deploy API (Render production service):
  - On deploy, API runs:
    - `prisma migrate deploy`
    - then starts Nest
- Deploy Web (Vercel production):
  - ensure `NEXT_PUBLIC_API_URL` points to production API URL

### 6.3 Post-Deploy Verification
- API:
  - `/healthz` and `/readyz`
- Web:
  - login works
  - pipeline loads
  - create/edit record works
  - attachments work (if enabled)
- DB:
  - confirm `_prisma_migrations` updated with new migration(s)

---

## 7) Handling Breaking Schema Changes

If a migration includes:
- column drops/renames
- data transforms
- making nullable fields required

Then:
1. Prefer multi-step migrations (expand → backfill → contract)
2. Update API to be backward-compatible across the migration window
3. Avoid destructive operations until data has been migrated
4. Test migration on a copy of production data if possible

---

## 8) Troubleshooting Playbook

### 8.1 Render fails during startup with Prisma error
- Usually missing `DATABASE_URL` or wrong env vars
- Check Render env vars first
- Confirm `packages/db/prisma/schema.prisma` path exists in container

### 8.2 Vercel shows 404 after “successful” build
- Ensure:
  - Framework preset = Next.js
  - Root Directory = `apps/web`
  - Output Directory is blank/default
- If Prisma warnings appear in web build logs:
  - set filtered install:
    - `pnpm -w install --filter @crm/web...`

### 8.3 Login fails in staging/prod
- Confirm users exist in Neon DB
- Seed staging DB if empty
- Confirm JWT secrets are set
- Confirm web API URL points to correct Render service

---

## 9) Operational Notes

- API migrations run on boot: `prisma migrate deploy`
- Do not rotate JWT secrets casually (will invalidate tokens)
- Keep Prisma CLI and @prisma/client versions aligned
- Prefer staging gate before production deploy