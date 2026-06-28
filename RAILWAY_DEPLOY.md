# Deploy Nova Royale to Railway

## Prerequisites

- GitHub account with the casino-platform repo pushed (Railway pulls from GitHub).
- Railway account (https://railway.app) connected to GitHub.
- Three subdomains you control (e.g. app.yourbrand.example, admin.yourbrand.example, api.yourbrand.example) for HTTPS.

## Step 1 - Push the repo

```powershell
cd C:\Users\devil\Documents\Codex\2026-06-26\you-are-a-senior-software-architect\casino-platform
git push -u origin main
```

If the repo `Mni2/online-bets` does not exist yet, create it empty on GitHub first, then push.

## Step 2 - Provision Postgres

In Railway dashboard:

1. **New Project -> Database -> PostgreSQL**.
2. Wait for the provisioning to finish. Copy the `DATABASE_URL` from the Variables tab - it will look like `postgresql://postgres:PASSWORD@HOST:PORT/railway`.

## Step 3 - Deploy the backend

1. **New -> GitHub Repo** -> pick `Mni2/online-bets`.
2. **Settings**:
   - **Dockerfile Path**: `apps/backend/Dockerfile`
   - **Watch Paths**: leave default (all).
   - **Healthcheck Path**: `/api/health`
   - **Healthcheck Timeout**: 100
3. **Variables** (paste these):

```
DATABASE_URL       = <paste from Step 2>
NODE_ENV           = production
BACKEND_PORT       = 4000
BACKEND_PUBLIC_URL = https://api.yourbrand.example
CORS_ORIGIN        = https://app.yourbrand.example,https://admin.yourbrand.example
JWT_ACCESS_SECRET  = <openssl rand -hex 48>
JWT_REFRESH_SECRET = <openssl rand -hex 48>
PROVABLY_FAIR_HMAC_KEY = <openssl rand -hex 32>
PROVABLY_FAIR_SERVER_SEED = <openssl rand -hex 32>
BCRYPT_ROUNDS      = 12
HOUSE_EDGE_BPS     = 150
```

4. Deploy. Wait for the build to succeed and the healthcheck to pass.

## Step 4 - Run migrations + seed

1. Open the backend service -> **Shell** tab.
2. Run:

```bash
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npx tsx packages/database/prisma/seed.ts
```

You should see "Seed complete:" with the admin user and the two seeded games.

## Step 5 - Add the API custom domain

In the backend service -> **Settings -> Networking -> Custom Domain**:

- Domain: `api.yourbrand.example`
- Railway auto-issues the Let's Encrypt cert. Note the CNAME target Railway tells you to point DNS at.

## Step 6 - Deploy the player frontend

1. **New -> GitHub Repo** -> pick the same `Mni2/online-bets`.
2. **Settings**:
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `npm install --legacy-peer-deps && npm run build`
   - **Start Command**: `npx next start -p $PORT`
   - **Healthcheck Path**: `/`
3. **Variables**:

```
NEXT_PUBLIC_API_URL = https://api.yourbrand.example
NODE_ENV            = production
```

4. Deploy. Then **Settings -> Networking -> Custom Domain**: `app.yourbrand.example`.

## Step 7 - Deploy the admin

1. **New -> GitHub Repo** -> same repo.
2. **Settings**:
   - **Root Directory**: `apps/admin`
   - **Build Command**: `npm install --legacy-peer-deps && npm run build`
   - **Start Command**: leave empty for static, or `npx serve -s dist -l $PORT` (install `serve` if you go that route).
3. **Variables**:

```
VITE_API_URL = https://api.yourbrand.example
```

4. Deploy. Then **Settings -> Networking -> Custom Domain**: `admin.yourbrand.example`.

## Step 8 - DNS

At your registrar, add three CNAMEs:

| Type | Name | Target |
| ---- | ---- | ------ |
| CNAME | api   | <railway-api-cname> |
| CNAME | app   | <railway-frontend-cname> |
| CNAME | admin | <railway-admin-cname> |

## Step 9 - First login

Visit `https://admin.yourbrand.example`. Sign in with:

- Email: `admin@novaroyale.example`
- Password: `ChangeMe!2026`

**Change this password immediately** under admin settings.

## Step 10 - Smoke test

```powershell
cd casino-platform
$env:API_BASE = "https://api.yourbrand.example"
npx tsx packages/shared/src/backend-smoke.ts
```

You should see `HTTP smoke: 21 passed, 0 failed`.

## Costs

| Service  | Plan    | Monthly |
| -------- | ------- | ------- |
| Postgres | starter | ~$5     |
| Backend  | starter | ~$5     |
| Frontend | starter | ~$2     |
| Admin    | starter | ~$1     |
| **Total**|         | **~$13/mo at low traffic** |

Railway's free trial gives you $5 of credit, so the first month is effectively free.

## Rolling back

If a deploy breaks healthchecks:

1. Railway keeps the previous successful image as a fallback.
2. Open **Deployments**, click on the last green deploy, **Redeploy**.
3. Or roll back via `railway up --detach` from the repo root after fixing.

## Observability

Railway gives you CPU, RAM, network, and replica metrics out of the box. For app-level logs:

- Each service has a **Logs** tab.
- For external aggregation, set the `LOG_LEVEL=debug` env var and pipe logs into [logtail](https://logtail.com) or [Axiom](https://axiom.co).

## Where to go next

- Set up [UptimeRobot](https://uptimerobot.com) pinging `/api/health` every 5 minutes with Slack alerts.
- Add [Sentry](https://sentry.io) for error tracking - drop `@sentry/node` into `apps/backend/src/server.ts`.
- Configure Postgres backups: Railway Pro plan includes automated daily backups; on Starter, take manual `pg_dump` snapshots via the shell tab.
