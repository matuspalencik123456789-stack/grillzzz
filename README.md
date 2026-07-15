# Grillz Studio

Production SaaS for designing, visualizing and ordering custom dental grillz from professional 3D dental scans.

## Monorepo layout

```
apps/
  frontend/        Next.js 15 (App Router) — customer studio, dashboard, admin
  backend/         NestJS API — auth, projects, scan pipeline, orders, payments
packages/
  database/        Prisma schema + generated client + seed
  shared-types/    Zod contracts shared by both apps (single source of truth)
  pricing-engine/  Pure, deterministic pricing (server-authoritative + client preview)
  cad-engine/      Pure mesh processing: STL/PLY/OBJ parse, validate, optimize,
                   jaw detection, tooth segmentation, STL/OBJ/glTF export
  three-engine/    Reusable React Three Fiber viewer engine
  ui/              Shared shadcn-style UI primitives
```

## Quick start (dev)

```bash
cp .env.example .env
docker compose up -d postgres redis minio minio-init   # Postgres 5432, Redis 6379, MinIO 9000
pnpm install
pnpm db:generate && pnpm db:migrate && pnpm db:seed    # schema + materials/patterns/admin
pnpm dev                                               # frontend :3000, backend :4000
```

Open http://localhost:3000 — register an account, or sign in as the seeded
admin `admin@grillz.studio` / `admin-dev-password` (override with
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before seeding).

### macOS

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and
[Node.js 22 LTS](https://nodejs.org) (or `brew install node@22`), then enable
pnpm with `corepack enable` (or `npm install -g pnpm@10`). Start Docker
Desktop and wait for the whale icon to settle, then run the quick start above.
The default `.env` already points at the Docker services (Postgres, Redis,
MinIO) — no edits needed.

### Windows

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(keep the WSL 2 option checked during setup), [Node.js 22 LTS](https://nodejs.org),
and [Git for Windows](https://git-scm.com/download/win), then run the quick
start above in PowerShell with two changes: get pnpm with
`npm install -g pnpm@10`, and copy the env file with
`copy .env.example .env`. If PowerShell refuses to run pnpm
("running scripts is disabled"), allow it once with
`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
and reopen the terminal.

**No admin rights?** See
[docs/WINDOWS-NO-ADMIN.md](./docs/WINDOWS-NO-ADMIN.md) — a fully user-level
setup (Scoop + `REDIS_URL="memory"`), no Docker required.

No dental scan at hand? Generate a synthetic test arch:

```bash
npx tsx -e "import{generateSyntheticArch,exportStl}from'./packages/cad-engine/src/index';import{writeFileSync}from'node:fs';writeFileSync('test-arch.stl',exportStl(generateSyntheticArch({toothCount:8})))"
```

then upload `test-arch.stl` in any project.

Verify the whole stack end-to-end (register → upload → pipeline → design →
AI → quote → order → payment → production → manufacturing files):

```bash
pnpm smoke
```

Full containerized stack: `docker compose --profile full up --build`
(migrations run automatically; see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)).

## Docs

- [ROADMAP.md](./ROADMAP.md) — delivery milestones
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — system design and decisions
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — production deployment, env reference, CI

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all apps in watch mode |
| `pnpm build` | Build everything (turbo, cached) |
| `pnpm test` | Unit tests (vitest) across packages |
| `pnpm typecheck` | Strict TS across the workspace |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed materials, patterns, demo admin |
