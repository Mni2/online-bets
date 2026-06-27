/// <reference types="node" />

interface Case { name: string; passed: boolean; detail?: string }
const results: Case[] = [];
const expect = (cond: boolean, name: string, detail?: string): void => {
  results.push({ name, passed: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} - ${name}${detail ? "  " + detail : ""}`);
};

const stubUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@novaroyale.example",
  username: "admin",
  displayName: "Admin",
  passwordHash: "stub-hash",
  role: "superadmin",
  kycStatus: "approved",
  emailVerifiedAt: new Date(),
  lastLoginAt: new Date(),
  lastLoginIp: "127.0.0.1",
  countryCode: "US",
  referralCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  wallets: [],
  vipProfile: null,
};

const stubWallet = {
  id: "00000000-0000-0000-0000-000000000002",
  userId: stubUser.id,
  currency: "USD",
  balance: "1000",
  locked: "0",
  bonusBalance: "0",
  version: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const stubLedger: any = {
  id: "00000000-0000-0000-0000-000000000003",
  walletId: stubWallet.id,
  type: "deposit",
  amount: "100",
  balanceAfter: "1000",
  lockedAfter: "0",
  referenceType: "payment_transaction",
  referenceId: "tx1",
  metadata: null,
  createdAt: new Date(),
};

const stubTxRow: any = {
  id: "tx1",
  walletId: stubWallet.id,
  status: "completed",
  currency: "USD",
  amount: "100",
  fee: "0",
  net: "100",
  method: "manual",
  createdAt: new Date(),
  completedAt: new Date(),
};

const stubGame: any = {
  id: "g1",
  slug: "dice-100",
  name: "Dice 100",
  category: "dice",
  rtp: "98.5",
  houseEdge: "1.5",
  isLive: false,
  enabled: true,
  config: { minBet: "0.10", maxBet: "10000" },
  thumbnailUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const stubBet: any = {
  id: "b1",
  userId: stubUser.id,
  gameId: stubGame.id,
  roundId: null,
  status: "won",
  currency: "USD",
  amount: "10",
  payout: "20",
  profit: "10",
  multiplier: "2",
  serverSeed: "x",
  serverSeedHash: "x",
  clientSeed: "y",
  nonce: 1,
  payload: {},
  result: { roll: 50, won: true },
  placedAt: new Date(),
  settledAt: new Date(),
};

const stubState = { registerCalls: 0 };

const liveWallet = { ...stubWallet, balance: "10000", locked: "0" };
const stubTx: any = {
  $queryRaw: async () => [{ "?column?": 1 }],
  $disconnect: async () => {},
  $transaction: async (fn: any) => fn(stubTx),
  user: {
    findUnique: async () => stubUser,
    findFirst: async () => (stubState.registerCalls === 0 ? null : stubUser),
    findMany: async () => [],
    count: async () => 0,
    create: async () => { stubState.registerCalls++; return stubUser; },
    update: async () => stubUser,
  },
  wallet: {
    findUnique: async () => { console.log('[stub.wallet.findUnique]', JSON.stringify({balance: liveWallet.balance, locked: liveWallet.locked})); return liveWallet; },
    findMany: async () => [liveWallet],
    create: async () => liveWallet,
    update: async (args: any) => { console.log('[stub.wallet.update] before', JSON.stringify({b: liveWallet.balance, l: liveWallet.locked}), 'data', JSON.stringify(args?.data)); const data = args.data ?? {}; for (const k of ['balance', 'locked', 'bonusBalance']) { if (typeof data[k] === 'string') liveWallet[k] = data[k]; } if (data.version && typeof data.version === 'object' && 'increment' in data.version) { liveWallet.version = (liveWallet.version ?? 0) + 1; } console.log('[stub.wallet.update] after', JSON.stringify({b: liveWallet.balance, l: liveWallet.locked})); return liveWallet; },
  },
  ledgerEntry: {
    findFirst: async () => stubLedger,
    findMany: async () => [],
    count: async () => 0,
    create: async () => stubLedger,
  },
  paymentTransaction: {
    create: async () => stubTxRow,
    findMany: async () => [],
    count: async () => 0,
  },
  game: {
    findUnique: async () => stubGame,
    findMany: async () => [stubGame],
  },
  bet: {
    create: async () => stubBet,
    update: async () => stubBet,
    findMany: async () => [],
    count: async () => 0,
    aggregate: async () => ({ _sum: { amount: 0, payout: 0 } }),
  },
  kycDocument: {
    findMany: async () => [],
    count: async () => 0,
    update: async () => ({ id: "k1", userId: stubUser.id }),
  },
  refreshToken: {
    create: async () => ({ id: "rt1" }),
    findUnique: async () => null,
    update: async () => ({}),
    updateMany: async () => ({ count: 1 }),
  },
  gameRound: {
    count: async () => 0,
    create: async () => ({ id: "r1", nonce: 1 }),
  },
};

(globalThis as any).__novaDbStub = stubTx;
(globalThis as any).__novaAuthStub = true;

process.env.NOVA_DB_STUB = "1";
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_access_long_enough_secret_1234567890";
process.env.JWT_REFRESH_SECRET = "test_refresh_long_enough_secret_1234567890";
process.env.PROVABLY_FAIR_HMAC_KEY = "test_hmac_key_for_smoke";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://stub:stub@localhost:5432/stub";
process.env.SMOKE_TEST = "1";

const serverMod = await import("../../../apps/backend/src/server.ts");
const buildServer = (serverMod as any).buildServer;

let app: any;
try {
  app = await buildServer();
  expect(true, "Fastify server built");
} catch (e: any) {
  expect(false, "Fastify server built", e.message);
  process.exit(1);
}

interface Check { method: string; url: string; expect: number; label: string }
const checks: Check[] = [
  { method: "GET", url: "/api/health", expect: 200, label: "GET /api/health" },
  { method: "GET", url: "/api/brand", expect: 200, label: "GET /api/brand" },
  { method: "GET", url: "/api/ready", expect: 200, label: "GET /api/ready" },
  { method: "GET", url: "/api/games", expect: 200, label: "GET /api/games (stubbed)" },
  { method: "GET", url: "/api/games/dice-100", expect: 200, label: "GET /api/games/dice-100" },
  { method: "GET", url: "/api/games/category/dice", expect: 200, label: "GET /api/games/category/dice" },
  { method: "GET", url: "/api/users/me", expect: 401, label: "GET /api/users/me without auth -> 401" },
  { method: "GET", url: "/api/admin/overview", expect: 401, label: "GET /api/admin/overview without auth -> 401" },
  { method: "GET", url: "/api/wallet", expect: 401, label: "GET /api/wallet without auth -> 401" },
  { method: "POST", url: "/api/auth/login", expect: 400, label: "POST /api/auth/login empty body -> 400 (validation)" },
  { method: "POST", url: "/api/auth/register", expect: 400, label: "POST /api/auth/register empty body -> 400 (validation)" },
  { method: "POST", url: "/api/games/dice/play", expect: 400, label: "POST /api/games/dice/play empty body -> 400 (validation)" },
];

for (const c of checks) {
  try {
    const res = await app.inject({ method: c.method as any, url: c.url, payload: c.method !== "GET" ? {} : undefined });
    const ok = res.statusCode === c.expect;
    expect(ok, c.label, `got=${res.statusCode} expected=${c.expect} body=${(res.body ?? "").slice(0, 200)}`);
  } catch (e: any) {
    expect(false, c.label, `error: ${e.message}`);
  }
}

try {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: "smoke@test.local",
      username: "smokeuser",
      password: "Strong-Pass-123",
      displayName: "Smoke",
      acceptTos: true,
      acceptAge: true,
    },
  });
  expect(res.statusCode === 200, "register endpoint happy path (stubbed)", `status=${res.statusCode} body=${(res.body ?? "").slice(0,200)}`);
  if (res.statusCode === 200) {
    const body = res.json();
    expect(typeof body.accessToken === "string" && body.accessToken.length > 50, "register response has JWT access token");
    expect(typeof body.refreshToken === "string" && body.refreshToken.length > 50, "register response has refresh token");
    expect(body.user && body.user.role === "superadmin", "register returns stubbed admin user");
  }
} catch (e: any) {
  expect(false, "register happy path", e.message);
}

try {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { identifier: "admin@novaroyale.example", password: "ChangeMe!2026" },
  });
  expect(login.statusCode === 200, "login happy path (stubbed)", `status=${login.statusCode} body=${(login.body ?? "").slice(0,200)}`);
  if (login.statusCode === 200) {
    const access = login.json().accessToken;
    const play = await app.inject({
      method: "POST",
      url: "/api/games/dice/play",
      headers: { authorization: `Bearer ${access}` },
      payload: { amount: "10", currency: "USD", target: 50, direction: "under", clientSeed: "smoke", nonce: 1, gameSlug: "dice-100" },
    });
    expect(play.statusCode === 200, "dice play happy path (stubbed)", `status=${play.statusCode} body=${(play.body ?? "").slice(0,200)}`);
    if (play.statusCode === 200) {
      const body = play.json();
      expect(typeof body.result?.roll === "number", "dice play returns roll");
      expect(typeof body.result?.roll === "number" && typeof body.result?.target === "number", "dice play returns roll + target for win determination");
    }
  }
} catch (e: any) {
  expect(false, "login+dice", e.message);
}

console.log("");
console.log("==================================================");
const passed = results.filter((r) => r.passed).length;
const failed = results.length - passed;
console.log(`HTTP smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const r of results.filter((x) => !x.passed)) console.log(`  FAIL: ${r.name} ${r.detail ?? ""}`);
  process.exit(1);
}