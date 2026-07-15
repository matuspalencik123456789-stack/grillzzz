# Running on Windows without admin rights

No Docker, no system installers, nothing that needs elevation — the whole
toolchain lives in your user profile. Redis is not needed at all: setting
`REDIS_URL="memory"` runs the cache, rate limiting, and job queue in-process
(dev-only mode, single backend instance).

## 1. Install Scoop (user-level package manager)

In PowerShell:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

```powershell
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

## 2. Install the toolchain

```powershell
scoop install git nodejs-lts postgresql minio
```

```powershell
npm install -g pnpm@10
```

Close and reopen PowerShell so the new commands are on PATH.

## 3. Start PostgreSQL

Scoop's PostgreSQL is pre-initialized with a `postgres` superuser and
password-less (trust) auth on localhost:

```powershell
pg_ctl -D "$env:USERPROFILE\scoop\apps\postgresql\current\data" start
```

```powershell
createdb -U postgres grillz_studio
```

If `createdb` complains that role `postgres` does not exist, your install was
initialized under your Windows username — run `createdb grillz_studio`
instead and use that username in `DATABASE_URL` below.

## 4. Start MinIO (S3-compatible storage)

In a second PowerShell window (leave it running):

```powershell
$env:MINIO_ROOT_USER = "grillz"
$env:MINIO_ROOT_PASSWORD = "grillz-secret"
minio server "$env:USERPROFILE\minio-data" --console-address :9001
```

One-time bucket setup: open http://localhost:9001, sign in with
`grillz` / `grillz-secret`, then **Buckets → Create Bucket** named
`grillz-studio`.

## 5. Clone and configure

```powershell
git clone https://github.com/matuspalencik123456789-stack/grillzzz.git
cd grillzzz
copy .env.example .env
```

Edit `.env` (e.g. `notepad .env`) and change exactly two lines:

```
DATABASE_URL="postgresql://postgres@localhost:5432/grillz_studio?schema=public"
REDIS_URL="memory"
```

## 6. Install, migrate, run

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000 — seeded admin login is
`admin@grillz.studio` / `admin-dev-password`.

## Next time

Only three things need starting again:

```powershell
pg_ctl -D "$env:USERPROFILE\scoop\apps\postgresql\current\data" start
```

MinIO (second window):

```powershell
$env:MINIO_ROOT_USER = "grillz"; $env:MINIO_ROOT_PASSWORD = "grillz-secret"; minio server "$env:USERPROFILE\minio-data" --console-address :9001
```

App:

```powershell
pnpm dev
```

## Notes

- `REDIS_URL="memory"` is for local development only: queues and rate limits
  live inside the single backend process, so they reset on restart and cannot
  be shared across instances. Production still uses Redis.
- Emails (verification, password reset, order confirmations) are printed to
  the backend terminal when no `RESEND_API_KEY` is set — copy links from
  there.
- If PowerShell blocks a command with "running scripts is disabled", re-run
  the `Set-ExecutionPolicy` line from step 1 and reopen the terminal.
