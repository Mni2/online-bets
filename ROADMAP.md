# Nova Royale — 60-step implementation roadmap

Each step is a self-contained Codex prompt you can drop into the chat one at a
time. The repo already implements steps M01–M18 (foundation, auth, wallet,
Dice game, player UI, admin UI, Docker). Steps M19–M60 add production depth.

## Phase 1 — Foundation (M01–M08) ? done
- M01 · Monorepo, workspaces, TypeScript strict.
- M02 · Design tokens + UI primitives.
- M03 · Prisma schema (users, wallets, ledger, payments, games, bets, KYC, audit, …).
- M04 · bcrypt auth + JWT + refresh rotation + RBAC.
- M05 · Wallet: getOrCreate, list, ledger writes, lock/settle/refund.
- M06 · Provably-fair RNG + Dice engine.
- M07 · Fastify API: auth, wallet, games, admin, system routes + Swagger UI.
- M08 · Docker compose for postgres, redis, backend, frontend, admin.

## Phase 2 — Player experience (M09–M16) ? done
- M09 · Marketing home + lobby.
- M10 · Auth screens (login, register with age + TOS).
- M11 · Wallet screen (deposit, withdraw, ledger history).
- M12 · Dice game screen with live canvas.
- M13 · Bet history screen.
- M14 · Provably-fair verifier modal.
- M15 · Mobile-first responsive tokens.
- M16 · Page-level error boundaries.

## Phase 3 — Admin console (M17–M20) ? done
- M17 · Admin login + role guard.
- M18 · Users, transactions, KYC queue.
- M19 · Risk dashboard with charts.
- M20 · Bonus manager (CRUD).

## Phase 4 — Payments and ledger hardening (M21–M26)
- M21 · Stripe payment intent + webhook handler.
- M22 · Coinbase Commerce crypto deposits.
- M23 · Manual SEPA / bank transfers with admin approval workflow.
- M24 · Withdrawal queue with daily limits + velocity rules.
- M25 · Idempotency key middleware on every write route.
- M26 · Reconciliation job (daily ledger vs PSP reports).

## Phase 5 — Game catalog (M27–M34)
- M27 · Crash game (multiplayer WebSocket).
- M28 · European Roulette (server-side wheel, provably-fair).
- M29 · Blackjack AZ (server-side shoe + hand eval).
- M30 · Slots engine (server-driven reels, RTP table).
- M31 · Live dealer integration adapter (provider-agnostic).
- M32 · Sportsbook pre-match adapter (BetGenius / OddsJam style).
- M33 · Game aggregator client (SoftSwiss / EveryMatrix style).
- M34 · Game catalog admin UI.

## Phase 6 — Bonuses, VIP, referrals (M35–M40)
- M35 · Bonus engine: wagering, max cashout, game weighting.
- M36 · Welcome bonus + deposit bonus templates.
- M37 · Cashback / rakeback cron.
- M38 · VIP tier engine + dedicated host assignment.
- M39 · Referral program with reward unlock rules.
- M40 · Tournament engine (leaderboard + prize pool).

## Phase 7 — Realtime & social (M41–M45)
- M41 · WebSocket gateway (Socket.IO / uWebSockets.js).
- M42 · Global chat with moderation and bans.
- M43 · Game chat + table chat.
- M44 · Live notifications (rain, big wins, jackpot drops).
- M45 · Presence service (online users + idle detection).

## Phase 8 — AI assistance (M46–M49)
- M46 · Responsible-gaming AI: behavioral signals + self-exclusion nudges.
- M47 · Bonus abuse detection (multi-account, chip dumping).
- M48 · AI KYC OCR for ID + liveness check.
- M49 · AI host assistant (recommends games, surfaces VIP perks).

## Phase 9 — Analytics and risk (M50–M54)
- M50 · Event ingestion pipeline (Kafka / NATS).
- M51 · Player LTV and churn dashboards.
- M52 · GGR / NGR / hold% reports.
- M53 · AML rule engine (structuring, velocity, jurisdictions).
- M54 · Operator BI exports (BigQuery / Snowflake).

## Phase 10 — Compliance and licensing (M55–M58)
- M55 · Multi-jurisdiction license framework.
- M56 · MGA / UKGC / Curaçao regulator adapters.
- M57 · RG limits: deposit, loss, session.
- M58 · Audit log retention + WORM storage.

## Phase 11 — Reliability and SRE (M59–M60)
- M59 · Multi-region active-active + DB replication.
- M60 · Chaos drills + DR runbook.

---

## How to use this roadmap

Each prompt is a single Codex message. They are designed to be executed in order
but can be reordered if your licensing, jurisdiction, or product priorities
dictate a different sequence.

A typical prompt looks like:

> “Implement roadmap step **M21**: integrate Stripe payment intents for deposits.
> Use the `@nova/wallet` ledger, idempotency keys, and webhook signature
> verification. Update the Prisma schema if needed, add tests, and document
> the new env vars in `.env.example`.”

Let me know which step you want to tackle next and I’ll prepare a detailed
prompt, write the code, run the checks, and document the result.
