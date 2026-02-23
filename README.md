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
