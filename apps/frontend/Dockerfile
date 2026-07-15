# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/pricing-engine/package.json packages/pricing-engine/
COPY packages/cad-engine/package.json packages/cad-engine/
COPY packages/three-engine/package.json packages/three-engine/
COPY packages/ui/package.json packages/ui/
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile=false --filter @grillz/frontend...

COPY packages packages
COPY apps/frontend apps/frontend

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# public API origin must be provided here, not at runtime.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @grillz/shared-types build \
 && pnpm --filter @grillz/pricing-engine build \
 && pnpm --filter @grillz/cad-engine build \
 && pnpm --filter @grillz/frontend build

# ── runtime (Next standalone) ────────────────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /repo/apps/frontend/.next/standalone ./
COPY --from=build /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /repo/apps/frontend/public ./apps/frontend/public
USER node
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
