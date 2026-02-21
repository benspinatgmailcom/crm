# ---------- Base ----------
FROM node:22-slim AS base
WORKDIR /repo
RUN corepack enable

# ---------- Dependencies ----------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ---------- Build ----------
FROM deps AS build
WORKDIR /repo
COPY . .

# Build the Nest API
RUN pnpm --filter @crm/api build

# Generate Prisma client
RUN pnpm --filter @crm/db exec prisma generate --schema=packages/db/prisma/schema.prisma

# ---------- Runtime ----------
FROM node:22-slim AS runtime
WORKDIR /repo
RUN corepack enable
ENV NODE_ENV=production

# Copy node_modules + built artifacts
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/packages/db ./packages/db
COPY --from=build /repo/packages/shared ./packages/shared

EXPOSE 3000

CMD ["pnpm", "--filter", "@crm/api", "start:prod:migrate"]