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
pnpm db:migrate # Create migration
pnpm db:studio  # Prisma Studio UI
```

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
