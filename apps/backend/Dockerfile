# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/pricing-engine/package.json packages/pricing-engine/
COPY packages/cad-engine/package.json packages/cad-engine/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile=false --filter @grillz/backend...

COPY packages/database packages/database
COPY packages/shared-types packages/shared-types
COPY packages/pricing-engine packages/pricing-engine
COPY packages/cad-engine packages/cad-engine
COPY apps/backend apps/backend

RUN pnpm --filter @grillz/database db:generate \
 && pnpm --filter @grillz/database build \
 && pnpm --filter @grillz/shared-types build \
 && pnpm --filter @grillz/pricing-engine build \
 && pnpm --filter @grillz/cad-engine build \
 && pnpm --filter @grillz/backend build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
USER node
EXPOSE 4000
CMD ["node", "apps/backend/dist/main.js"]
