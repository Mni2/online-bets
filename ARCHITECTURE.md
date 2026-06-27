# Nova Royale — Architecture

## Goals

- Production-grade online casino platform with modular services.
- Strict TypeScript everywhere; zero `any` in shipped code.
- Provably-fair games, hardened wallet, fast payouts, full KYC/AML trail.
- Mobile-first player experience and operationally rich admin console.
- Runs on a single Postgres + Redis for small deployments, but every domain
  service (auth, wallet, games, KYC, payments, chat, leaderboard, analytics,
  notifications) can be split into its own microservice without rewriting
  application code.

## High-level topology

```
                     +--------------------------+
                     ¦       Player Frontend    ¦  Next.js 14 App Router
                     ¦       (apps/frontend)    ¦  React Server + Client
                     +--------------------------+
                                  ¦ HTTPS / JSON + JWT
                                  ?
                     +--------------------------+
                     ¦        Backend API       ¦  Fastify + zod + Swagger
                     ¦       (apps/backend)     ¦  Helmet, CORS, RateLimit
                     +--------------------------+
                          ¦         ¦        ¦
                  +-------?--+  +---?----+ +-?----------+
                  ¦   auth   ¦  ¦ wallet ¦ ¦   games    ¦  (packages/*)
                  ¦ JWT, RBAC¦  ¦ ledger ¦ ¦ provably   ¦
                  ¦ refresh  ¦  ¦ locks  ¦ ¦   fair RNG ¦
                  +----------+  +--------+ +------------+
                        ¦           ¦          ¦
                        +----------------------+
                                 ?
                    +----------------------------+
                    ¦     Postgres + Prisma      ¦
                    ¦  (packages/database)       ¦
                    +----------------------------+

                     +--------------------------+
                     ¦      Admin Console       ¦  Vite + React + react-router
                     ¦       (apps/admin)       ¦
                     +--------------------------+
                                  ¦ HTTPS / JSON + JWT
                                  ?
                              Backend API
```

## Domain boundaries

| Domain    | Package           | Responsibility                                                            |
| --------- | ----------------- | ------------------------------------------------------------------------- |
| Identity  | `@nova/auth`      | bcrypt, JWT, refresh rotation, sessions, RBAC, password policy.          |
| Money     | `@nova/wallet`    | Double-entry ledger, lock/settle/refund, idempotent ledger writes.       |
| Games     | `@nova/games`     | Provably-fair RNG, dice/crash/roulette/blackjack engines, round registry. |
| Data      | `@nova/database`  | Prisma schema, generated client, migrations, seed.                       |
| UI        | `@nova/ui`        | Tokens, primitives (Button, Card, Input, Badge, Stat, Table).            |
| Shared    | `@nova/shared`    | Decimal math, ids, hashing, constants, logging helpers.                  |
| Types     | `@nova/types`     | Zod schemas + inferred TypeScript types shared across the stack.          |

## Money model

All amounts are stored as `Decimal(36, 8)` strings in Postgres. The `@nova/shared`
package provides BigInt-backed helpers for `toMinor` / `fromMinor` so we never
lose precision. The wallet is double-entry:

- `balance` is what the player can bet or withdraw.
- `locked` is what is currently tied to in-flight bets.
- `bonusBalance` is promotional money subject to wagering requirements.

Every change goes through a Prisma transaction that:

1. Reads the wallet row.
2. Validates the new balance against the requested delta.
3. Updates the wallet with optimistic versioning.
4. Writes a `LedgerEntry` row with `idempotencyKey` so retries are safe.

## Provably fair model

- Before each round the operator publishes `serverSeedHash = HMAC_SHA256(serverSeed, PROVABLY_FAIR_HMAC_KEY)`.
- The player contributes `clientSeed` and a `nonce`.
- Roll derivation: `roll = bucketize(HMAC_SHA256(serverSeed, clientSeed + ":" + nonce)) % 100_000 / 1000`.
- After settlement the operator reveals `serverSeed`. Players can re-derive the
  hash and confirm it matches the pre-round commitment.

## Auth model

- Email + username registration with age and TOS gates.
- 12-round bcrypt hashing.
- Short-lived access tokens (15m default) + rotating refresh tokens (30d).
- Each refresh issues a new refresh token and revokes the previous one.
- Sessions are stored in `Session` table for audit / “sign out everywhere”.
- RBAC: `player`, `vip`, `moderator`, `admin`, `superadmin`. `requireRole` is
  enforced via Fastify pre-handler and re-checked in admin routes.

## Performance budget

- API p50 < 80 ms, p95 < 250 ms for non-game endpoints.
- Dice `/play` round-trip < 200 ms including ledger writes.
- Lobby and history responses use Redis-backed caching in front of Postgres
  when traffic warrants it (see ROADMAP.md M49).

## Security baseline

- `@fastify/helmet` for hardened headers.
- `@fastify/rate-limit` at 240 req/min/IP per default, lowered for auth.
- Password hashing: bcrypt rounds 12.
- JWT secrets loaded from environment, never bundled.
- Constant-time comparison for sensitive string equality.
- All money changes run in transactions; idempotency keys prevent duplicate writes.
- Audit log for every admin action.

## Microservice readiness

Each `@nova/*` package is a private module behind a stable TypeScript surface.
To split a service, copy the package, expose it as a separate process, and
replace direct imports with HTTP or gRPC clients. The data model already
isolates ownership (e.g., `Wallet` belongs to a single `User`), so horizontal
sharding by user id is straightforward.

## Testing & QA

- Unit tests for `@nova/shared`, `@nova/wallet`, `@nova/games` (Vitest).
- Integration tests against a Postgres test container for the API.
- Playwright smoke tests for the player and admin apps.
- Provably-fair regression test that replays 10k seeds and asserts uniformity.

## Compliance hooks

- `kycStatus` on every user; admin queue for KYC review.
- `selfExcludedUntil` field for responsible-gaming enforcement.
- `RiskEvent` model and `AuditLog` for AML investigations.
- Region gating via `countryCode` (already on `User`).
- Per-jurisdiction tax / RTP rules live in a `RegulationProfile` table (ROADMAP M47).
