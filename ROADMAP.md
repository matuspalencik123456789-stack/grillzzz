# Grillz Studio — Delivery Roadmap

Work is delivered in vertical milestones. Every milestone leaves `main` shippable.

## M1 — Foundation (this repo state: done first)
- pnpm + Turborepo monorepo, strict TS base config, Prettier
- Complete Prisma schema (15 domain tables + Auth.js tables), seed data
- `shared-types`: Zod wire contracts, FDI tooth numbering, enums, queue event payloads
- Docker Compose: Postgres 16, Redis 7, MinIO (S3), app profiles
- Architecture documentation

## M2 — Domain engines
- `pricing-engine`: deterministic quote computation — metal weight from CAD volume,
  karat/material pricing, stone counts by density/spacing, labor model, tax, shipping.
  Unit-tested. Runs identically on server (authoritative) and client (realtime preview).
- `cad-engine`: pure-TS mesh core — binary/ASCII STL, PLY, OBJ parsers; mesh validation
  (degenerate triangles, NaN, non-finite, empty); geometry optimization (vertex weld,
  index dedup); recenter; vertex-normal computation; AABB; upper/lower jaw detection;
  arch-based tooth segmentation to FDI numbers; binary STL / OBJ / glTF 2.0 exporters.
  Unit-tested with synthetic dental arches.

## M3 — Backend (NestJS)
- Auth: credentials + Google-federated identities, JWT access/refresh, RBAC guards
- Projects, organizations, dental-scan upload via S3 presigned URLs
- BullMQ scan pipeline: validate → optimize → center → normals → bbox → jaw detect →
  tooth segmentation → GLB + thumbnail render job
- Grillz designs CRUD with Zod-validated config, server-side authoritative pricing
- AI service (Anthropic; deterministic rules fallback): design generation, price
  estimation, manufacturing validation, material & diamond recommendation
- Orders + payments (provider abstraction, Stripe adapter), production jobs queue,
  rendering jobs, audit logs, notifications, admin module
- Security: helmet, rate limiting (Redis), file validation, Zod pipes, audit trail

## M4 — 3D engine + UI packages
- `three-engine`: R3F viewport with orbit/pan/zoom, lighting presets, HDRI environment
  switching, PBR material editor, realtime reflections, soft shadows, wireframe mode,
  clipping-plane section view, point-to-point measurement tool, LOD helpers
- `ui`: shadcn-style primitives themed for the luxury dark design system

## M5 — Frontend (Next.js App Router)
- Auth.js v5 (Google + email credentials) bridged to backend JWTs
- Dashboard: projects, orders, invoices, saved designs, favorites, notifications
- Studio: scan viewer, per-tooth FDI selection (hover/multi-select/highlight),
  grillz builder (single/2/4/6/8/upper/lower/full), materials, finishes, thickness /
  offset / fit / chamfer / edge-radius sliders, diamonds, patterns, engraving,
  realtime price panel, AI design generator, manufacturing export
- Checkout + order tracking; admin: users, orders, pricing, materials, inventory,
  production queue, analytics

## M6 — Hardening
- Full typecheck/test pass in CI, Dockerfiles for both apps, deployment docs

## Post-v1 (not in this codebase yet, tracked here deliberately)
- Photoreal path-traced render farm for marketing renders
- True ML tooth segmentation model (current: geometric arch heuristic behind the same
  interface, so the swap is a worker-only change)
- Multi-currency + regional tax providers (current: pluggable tax table)
