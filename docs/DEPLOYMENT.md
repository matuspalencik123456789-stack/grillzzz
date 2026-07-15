# Deployment

Grillz Studio ships as two containers (frontend, backend) plus three infra
services (PostgreSQL 16, Redis 7, S3-compatible object storage). The backend
container also runs the BullMQ workers (scan pipeline, rendering, production),
so a single backend replica is a complete system.

```
browser ──► frontend (Next.js, :3000) ──► backend (NestJS, :4000)
                                             │
                              ┌──────────────┼──────────────┐
                          PostgreSQL       Redis        S3 bucket
                          (data)           (queues,     (scans, GLBs,
                                           rate limit)  thumbnails, exports)
```

## Option A — single host with Docker Compose

Everything, including infra, on one machine. Good for staging and small
production.

```bash
git clone <repo> grillz-studio
cd grillz-studio
cp .env.example .env
```

Edit `.env` and set real secrets (see the reference table below — at minimum
`JWT_SECRET` and `AUTH_SECRET`). Then:

```bash
export PUBLIC_API_URL=https://api.example.com
export PUBLIC_APP_URL=https://app.example.com
docker compose --profile full up -d --build
```

What happens on `up`:

1. `postgres`, `redis`, `minio` start with healthchecks.
2. `minio-init` creates the `grillz-studio` bucket.
3. `migrate` runs `prisma migrate deploy` and exits.
4. `backend` starts only after migrations succeeded and the bucket exists.
5. `frontend` starts last. `PUBLIC_API_URL` is baked into the client bundle at
   image build time (it is a `NEXT_PUBLIC_*` variable), so rebuild the frontend
   image whenever it changes.

Seed the catalog (materials, patterns) and the first admin user once:

```bash
docker compose --profile full run --rm \
  -e SEED_ADMIN_EMAIL=admin@example.com \
  -e SEED_ADMIN_PASSWORD=a-strong-password \
  migrate sh -c "cd packages/database && npx tsx prisma/seed.ts"
```

For local evaluation you can omit `PUBLIC_API_URL` / `PUBLIC_APP_URL` — the
defaults are `http://localhost:4000` / `http://localhost:3000`.

Put a TLS-terminating reverse proxy (Caddy, nginx, Traefik) in front of ports
3000 and 4000; the apps themselves serve plain HTTP.

## Option B — managed platform (Kubernetes, ECS, Fly, Railway, …)

Build the two images from the repo root:

```bash
docker build -f apps/backend/Dockerfile -t grillz-backend .
docker build -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  -t grillz-frontend .
```

Provision managed PostgreSQL, Redis, and S3 (or any S3-compatible store), then
supply the environment variables below. Run migrations as a release/init step
before rolling out a new backend version:

```bash
docker run --rm -e DATABASE_URL=... grillz-backend \
  sh -c "cd packages/database && npx prisma migrate deploy --schema=prisma/schema.prisma"
```

The backend is stateless (all state lives in Postgres/Redis/S3) and scales
horizontally; BullMQ distributes queue jobs across replicas automatically.
The frontend standalone server is stateless as well.

## Environment reference

### Backend

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `REDIS_URL` | yes | Queues, cache, rate limiting. `memory` = in-process dev-only mode, never use in production |
| `S3_ENDPOINT` | yes | e.g. `https://s3.us-east-1.amazonaws.com` or MinIO URL |
| `S3_REGION` | no | Default `us-east-1` |
| `S3_BUCKET` | yes | Bucket for scans/exports |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | yes | |
| `S3_FORCE_PATH_STYLE` | no | `true` for MinIO, unset for AWS |
| `JWT_SECRET` | yes | ≥ 32 chars; signs access/refresh tokens |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | no | Defaults `15m` / `30d` |
| `API_PORT` | no | Default `4000` |
| `API_CORS_ORIGIN` | yes | The frontend origin (browser requests) |
| `AUTH_SECRET` | yes | Must equal the frontend value — authenticates the internal federated-login endpoint |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | no | Empty ⇒ mock payment provider (dev only) |
| `ANTHROPIC_API_KEY` | no | Empty ⇒ deterministic rules-engine AI fallback |
| `AI_MODEL` | no | Default `claude-sonnet-5` |
| `RESEND_API_KEY` | no | Transactional email (verification, password reset, order confirmations). Empty ⇒ emails are logged to stdout instead of sent |
| `MAIL_FROM` | no | Default `Grillz Studio <no-reply@grillz.studio>`; the domain must be verified in Resend |
| `APP_URL` | yes | Public frontend origin used in email links |

### Frontend

| Variable | Required | When | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | **build time** | API origin used by the browser; baked into the bundle |
| `API_INTERNAL_URL` | no | runtime | API origin for server-side calls (e.g. `http://backend:4000` inside a docker network); falls back to the baked public URL |
| `AUTH_SECRET` | yes | runtime | Auth.js session encryption; same value as backend |
| `AUTH_URL` | yes | runtime | Public URL of the frontend |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no | runtime | Enables Google sign-in |

## Production checklist

- [ ] `JWT_SECRET` and `AUTH_SECRET` replaced with strong random values
      (`openssl rand -base64 48`) — the backend refuses the shipped defaults
      outside dev only by convention, so verify this yourself.
- [ ] Postgres backups scheduled (pgdata volume or managed snapshots).
- [ ] S3 bucket is private; the app only hands out short-lived presigned URLs.
- [ ] Stripe: real `STRIPE_SECRET_KEY`, webhook endpoint
      `POST /api/v1/payments/webhook` registered in the Stripe dashboard and
      `STRIPE_WEBHOOK_SECRET` set — otherwise payments run against the mock
      provider.
- [ ] Google OAuth redirect URI `https://<app>/api/auth/callback/google`
      registered if Google sign-in is enabled.
- [ ] `RESEND_API_KEY` set and the `MAIL_FROM` domain verified (SPF/DKIM) in
      Resend — otherwise verification, password-reset, and order emails are
      only written to backend logs.
- [ ] Seed run once with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` overridden.
- [ ] Reverse proxy passes `Host`/`X-Forwarded-*` headers (Auth.js uses them
      via `trustHost`).
- [ ] Monitoring hits `GET /health` (liveness) and `GET /health/ready`
      (DB + Redis + S3 readiness).

## CI

`.github/workflows/ci.yml` runs on every push and PR:

- **quality** — full monorepo build, strict typecheck, all unit tests.
- **e2e-smoke** — boots Postgres/Redis/MinIO, applies migrations, seeds,
  starts the real backend, and runs `scripts/e2e-smoke.ts`: register → project
  → presigned S3 upload of a synthetic arch → scan pipeline → tooth detection
  → design → AI → authoritative quote → order → payment → production queue →
  manufacturing artifacts → notifications.
