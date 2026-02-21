# Database migrations

Schema and migrations live in **`packages/db`**. The Prisma schema is at `packages/db/prisma/schema.prisma`.

## Local / development

- **Apply pending migrations:**  
  `pnpm db:migrate`  
  (runs `prisma migrate dev`: applies migrations and regenerates the client.)

- **Reset and reapply all:**  
  `pnpm db:migrate -- --reset`  
  (drops DB, reapplies all migrations. Destructive.)

- **Schema-only sync (no migration files):**  
  `pnpm db:push`  
  (good for quick dev iteration; not for production.)

## Production

1. **Run migrations before deploying app code** that depends on new schema.
2. **Use deploy mode** (no interactive prompts, no migration creation):

   ```bash
   cd packages/db && npx prisma migrate deploy
   ```

   Or from repo root:

   ```bash
   pnpm exec prisma migrate deploy --schema=packages/db/prisma/schema.prisma
   ```

3. **Regenerate the Prisma client** as part of your API build (e.g. `pnpm db:generate` in CI before `pnpm build`), or ensure the built API was generated against the same schema as the migrations you deploy.
4. **Order of operations:** run `prisma migrate deploy` against the production DB, then deploy the new API (and any other services that use the DB). Avoid deploying code that requires new columns or indexes before the migration has been applied.
5. **Backups:** take a backup or ensure point-in-time recovery before applying migrations in production.

## Indexes (reference)

- **Opportunity pipeline:** `(stage, updatedAt, closeDate)` — for pipeline fetch by stage with ordering.
- **Activity timeline:** `(entityType, entityId, createdAt)` — for timeline by entity.
- **Attachment lookup:** `(entityType, entityId, createdAt)` — for listing attachments by entity.
