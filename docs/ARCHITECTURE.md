# Grillz Studio — Architecture

## System overview

```
 ┌────────────┐   HTTPS/JSON   ┌─────────────┐   BullMQ    ┌──────────────┐
 │  Next.js   │ ─────────────▶ │  NestJS API │ ──────────▶ │ Scan/Render  │
 │  frontend  │ ◀───────────── │  (REST)     │ ◀────────── │   workers    │
 └────────────┘                └─────────────┘             └──────────────┘
       │                          │      │                        │
       │ presigned PUT/GET        │      │                        │
       ▼                          ▼      ▼                        ▼
 ┌────────────┐            ┌──────────┐ ┌───────┐          ┌──────────┐
 │ S3 / MinIO │            │ Postgres │ │ Redis │          │ S3/MinIO │
 └────────────┘            └──────────┘ └───────┘          └──────────┘
```

## Key decisions

### 1. Pure domain packages, framework-free
`cad-engine` and `pricing-engine` depend on nothing but the standard library and
typed arrays. Consequences:

- The **same pricing code** produces the realtime price in the browser and the
  authoritative quote on the server. The server snapshot stored on the order is the
  only legally binding number; the client preview can never drift because it is the
  identical function.
- `cad-engine` runs in Node workers (scan pipeline, manufacturing export) *and* in the
  browser (client-side pre-upload validation) without bundling three.js twice.

### 2. Zod contracts in `shared-types`
Every request/response body is a Zod schema. The backend validates with a custom
`ZodValidationPipe`; the frontend derives React Hook Form resolvers from the same
schemas. Enums used by Prisma are mirrored as Zod enums and unit-checked against the
generated client, so DB, API and UI can never disagree on e.g. `MaterialType`.

### 3. Scan pipeline as a queue, not a request
Professional dental scans are 10–200 MB. Upload goes browser → S3 directly via
presigned URL; the API only issues the URL and records intent. A BullMQ job then runs:

```
validate → optimize (weld/dedup) → center → normals → bbox → jaw detect
        → tooth segmentation (FDI) → GLB export → thumbnail render
```

Each stage persists status on `DentalScan.status`, so the UI streams progress.
Tooth segmentation is behind a `ToothSegmenter` interface — the shipped implementation
is a geometric arch-parameterization heuristic; an ML model swaps in as a worker-only
change.

### 4. Server-authoritative pricing with snapshots
`POST /pricing/quote` computes a quote and returns a signed snapshot (inputs + line
items + totals + version of the price book). Order placement requires the snapshot;
the server recomputes and rejects on mismatch. Price-book changes therefore never
mutate quoted carts.

### 5. AI behind a provider interface
`AiService` has two providers: Anthropic (when `ANTHROPIC_API_KEY` is set) and a
deterministic rules engine. Both return the **same Zod-validated types**
(`AiDesignSuggestion`, `AiValidationReport`, …). AI output is never trusted raw:
design suggestions are parsed through `grillzConfigSchema.partial()` and clamped to
manufacturable ranges before touching the UI or DB.

### 6. AuthN/AuthZ
- Frontend session: Auth.js v5 (Google OAuth + email credentials).
- API: short-lived JWT access tokens + rotating refresh tokens (hashed in DB).
- RBAC: `Role` (CUSTOMER, MANUFACTURER, ADMIN) enforced by a `@Roles()` guard;
  organization-scoped resources additionally check membership.
- Every privileged mutation writes an `AuditLog` row via an interceptor.

### 7. Repository pattern where it pays
Prisma is already a repository over SQL; we wrap it only where domain invariants live
(orders, payments, production) so business rules aren't scattered through services.
Simple CRUD (materials, patterns) talks to Prisma directly — indirection without
invariants is cost, not cleanliness.

### 8. Frontend architecture
- **Feature folders** under `src/features/*` (studio, projects, orders, admin…), each
  owning components, hooks, api calls and store slices.
- **Zustand** holds studio design state (selected teeth, config) — high-frequency 3D
  UI state that must not round-trip React Query.
- **React Query** owns all server state, keyed by resource; mutations invalidate.
- 3D code is dynamically imported (`next/dynamic`, `ssr: false`); heavy geometry is
  transferred as GLB and rendered with Suspense fallbacks.

## Data model notes

- `Tooth` rows are produced by the pipeline per scan, keyed by FDI number, storing
  centroid/bbox/vertex-range so the viewer can build selectable submeshes without
  re-segmenting.
- `Grillz.configJson` is the full designer document (validated `GrillzConfig`);
  scalar columns (materialId, setType…) are denormalized for querying/analytics.
- `Order.quoteJson` stores the immutable price snapshot; `Payment` rows track provider
  state transitions; `ProductionJob` is the manufacturer-facing workflow entity.

## Security

- Helmet, CORS allow-list, Redis-backed rate limiting (per-IP + per-user)
- Upload validation: extension + magic-byte sniffing + size caps + mesh sanity checks
- Zod validation on every body/query/param; Prisma parameterization for SQL
- Audit logs on auth events and all admin/order/payment mutations
