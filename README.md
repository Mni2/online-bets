# Nova Royale

A production-ready, modular, enterprise-grade online casino platform. Nova Royale is
designed for serious operators who need provably-fair games, a hardened wallet, fast
payouts, KYC/AML flows, and a full admin console — all in a single TypeScript monorepo.

> **Disclaimer.** Operating an online casino requires a gambling license, KYC/AML
> controls, age verification, certified RNG, and certified game providers. Nova Royale
> provides the software foundation only. You are responsible for licensing and
> regulatory compliance in your jurisdiction.

## Highlights

- **Provably fair** HMAC-SHA256 RNG with verifiable seeds (`server_seed`,
  `server_seed_hash`, `client_seed`, `nonce`).
- **Double-entry ledger** wallet with locked funds, bonus balance, and idempotent
  transactions.
- **Fastify** backend with JWT auth, refresh token rotation, RBAC, rate limiting,
  Swagger UI, and a typed `zod` request pipeline.
- **Next.js 14** mobile-first player front-end with auth, lobby, dice game, wallet,
  and history views.
- **Vite + React** admin console for KYC review, transactions, and user management.
- **PostgreSQL** schema with 18+ models (users, wallets, ledger, payments, games,
  bets, KYC, sessions, audit, risk, notifications, chat, bonuses, VIP, referrals).
- **Docker** compose for postgres, redis, backend, frontend, admin.
- **TypeScript strict** across all packages and apps.

## Project layout

```
casino-platform/
  apps/
    frontend/        Next.js 14 App Router (mobile-first player UI)
    admin/           Vite + React admin console
    backend/         Fastify API + Swagger UI at /docs
  packages/
    ui/              Themed React primitives + CSS tokens
    types/           Zod schemas + TypeScript types
    shared/          Money helpers, ids, hashing, constants
    database/        Prisma schema, generated client, seed
    auth/            bcrypt, JWT, refresh rotation, RBAC helpers
    wallet/          Double-entry ledger + lock/settle/refund
    games/           Provably-fair RNG + Dice engine + game registry
```

## Quick start

### Prerequisites

- Node.js 20.10+
- npm 10+
- (optional) Docker Desktop for the container stack
- PostgreSQL 16 if running without Docker

### 1. Configure environment

Copy `.env.example` to `.env` and adjust secrets:

```powershell
cp .env.example .env
```

### 2. Install and run (local Postgres)

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:backend   # http://localhost:4000 (Swagger at /docs)
npm run dev:frontend  # http://localhost:3000
npm run dev:admin     # http://localhost:5173
```

Default seed account: `admin@novaroyale.example` / `ChangeMe!2026`.

### 3. Or run the full Docker stack

```powershell
docker compose up --build
```

Services:

| Service  | URL                     | Notes                                       |
| -------- | ----------------------- | ------------------------------------------- |
| Frontend | http://localhost:3000   | Player UI (Next.js)                         |
| Admin    | http://localhost:5173   | Admin console (Vite + nginx)                |
| Backend  | http://localhost:4000   | Fastify API + Swagger UI at `/docs`         |
| Postgres | localhost:5432          | DB user `nova`, password `nova`             |
| Redis    | localhost:6379          | Cache, rate-limit, leaderboards, presence   |

## Provably-fair verification

Every Dice bet reveals its `serverSeed` after settlement. To verify:

1. Hash the `serverSeed` with HMAC-SHA256 using `PROVABLY_FAIR_HMAC_KEY`.
2. Compare with the `serverSeedHash` that was published before the bet.
3. Re-derive the roll:
   `roll = HMAC_SHA256(serverSeed, clientSeed + ":" + nonce) -> 0..99.999`.
4. Compare with the `result.roll` returned to the player.

A reference implementation is provided in
[`packages/games/src/index.ts`](./packages/games/src/index.ts) (`verifyFairness`).

## License

UNLICENSED — proprietary. You are responsible for obtaining a gambling license and
complying with KYC/AML, age verification, and consumer protection rules in your
jurisdiction before deploying Nova Royale to production.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design and
[ROADMAP.md](./ROADMAP.md) for the 60-step implementation plan.
