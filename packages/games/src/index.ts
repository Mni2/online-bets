import { createHmac, randomBytes } from "node:crypto";
import {
  compareDecimal,
  hmacSha256,
  mulDecimal,
  subDecimal,
  ZERO,
} from "@nova/shared";
import type {
  DiceBet,
  DiceResult,
  Game,
  GameCategory,
  ProvablyFairSeedPair,
} from "@nova/types";

const HOUSE_EDGE_BPS = Number(process.env.HOUSE_EDGE_BPS ?? 150);
const MIN_BET = process.env.MIN_BET_DEFAULT ?? "0.10";
const MAX_BET = process.env.MAX_BET_DEFAULT ?? "10000";
const ROLLOVER_BUCKETS = 100_000; // 0.00000 to 100.00000

const deriveRoll = (
  serverSeed: string,
  clientSeed: string,
  nonce: number
): number => {
  // HMAC_SHA256 produces 64 hex chars; chunk into 4-byte slices for more entropy.
  const hmac = hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
  const buckets: number[] = [];
  for (let i = 0; i < hmac.length; i += 8) {
    const slice = hmac.slice(i, i + 8);
    const value = parseInt(slice, 16);
    if (!Number.isFinite(value)) continue;
    buckets.push(value % 1000);
  }
  // Mix chunks for uniform distribution over ROLLOVER_BUCKETS.
  let roll = 0;
  for (const b of buckets) roll = (roll * 1000 + b) % ROLLOVER_BUCKETS;
  return roll / 1000; // 0.000 .. 99.999
};

export const newServerSeed = (): string => randomBytes(32).toString("hex");
export const hashServerSeed = (seed: string): string =>
  createHmac("sha256", process.env.PROVABLY_FAIR_HMAC_KEY ?? "nova_pf_key")
    .update(seed)
    .digest("hex");

export interface StartRoundInput {
  gameSlug: string;
  clientSeed: string;
}

export const startRound = async (
  prisma: import("@nova/database").PrismaClient,
  input: StartRoundInput
): Promise<{ roundId: string; serverSeedHash: string; clientSeed: string; nonce: number }> => {
  const game = await prisma.game.findUnique({ where: { slug: input.gameSlug } });
  if (!game) throw new Error("game_not_found");
  const serverSeed = newServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const existing = await prisma.gameRound.count({ where: { gameId: game.id } });
  const round = await prisma.gameRound.create({
    data: {
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: input.clientSeed,
      nonce: existing + 1,
    },
  });
  return {
    roundId: round.id,
    serverSeedHash,
    clientSeed: input.clientSeed,
    nonce: round.nonce,
  };
};

export interface DicePlayInput extends DiceBet {
  userId: string;
  gameSlug: string;
}

export interface DicePlayResult {
  betId: string;
  result: DiceResult;
}

const diceMultiplier = (target: number, direction: "under" | "over"): number => {
  // 99% RTP minus house edge on the worst side.
  const winChance = direction === "under" ? target - 1 : 100 - target;
  if (winChance <= 0) throw new Error("invalid_target");
  const houseMultiplier = 10_000 - HOUSE_EDGE_BPS; // bps of 100% RTP
  return Number((houseMultiplier / (winChance * 100)).toFixed(4));
};

export const playDice = async (
  prisma: import("@nova/database").PrismaClient,
  lockFunds: (input: {
    userId: string;
    currency: import("@nova/database").Currency;
    amount: string;
    referenceType: string;
    referenceId: string;
  }) => Promise<void>,
  settleFunds: (input: {
    userId: string;
    currency: import("@nova/database").Currency;
    betAmount: string;
    payout: string;
    referenceType: string;
    referenceId: string;
  }) => Promise<{ payout: string }>,
  input: DicePlayInput
): Promise<DicePlayResult> => {
  if (compareDecimal(input.amount, MIN_BET) < 0) throw new Error("bet_below_minimum");
  if (compareDecimal(input.amount, MAX_BET) > 0) throw new Error("bet_above_maximum");

  const game = await prisma.game.findUnique({ where: { slug: input.gameSlug } });
  if (!game || !game.enabled) throw new Error("game_unavailable");

  // Ensure the wallet exists before playing to avoid "wallet_not_found" error
  const { getOrCreateWallet } = await import("@nova/wallet");
  await getOrCreateWallet({ userId: input.userId, currency: input.currency });

  const serverSeed = newServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);

  const bet = await prisma.bet.create({
    data: {
      userId: input.userId,
      gameId: game.id,
      currency: input.currency,
      amount: input.amount,
      status: "pending",
      payload: {
        target: input.target,
        direction: input.direction,
        clientSeed: input.clientSeed,
        nonce: input.nonce,
      } as object,
      serverSeedHash,
      clientSeed: input.clientSeed,
      nonce: input.nonce,
    },
  });

  await lockFunds({
    userId: input.userId,
    currency: input.currency,
    amount: input.amount,
    referenceType: "bet",
    referenceId: bet.id,
  });

  const roll = deriveRoll(serverSeed, input.clientSeed, input.nonce);
  const won =
    input.direction === "under" ? roll < input.target : roll > input.target;

  const multiplier = diceMultiplier(input.target, input.direction);
  const payout = won ? mulDecimal(input.amount, multiplier.toString()) : ZERO;
  const profit = subDecimal(payout, input.amount);

  await settleFunds({
    userId: input.userId,
    currency: input.currency,
    betAmount: input.amount,
    payout,
    referenceType: "bet",
    referenceId: bet.id,
  });

  const updated = await prisma.bet.update({
    where: { id: bet.id },
    data: {
      status: won ? "won" : "lost",
      payout,
      profit,
      multiplier: multiplier.toString(),
      serverSeed,
      result: { roll, won },
      settledAt: new Date(),
    },
  });

  const dto: DiceResult = {
    betId: updated.id,
    roll,
    target: input.target,
    direction: input.direction,
    amount: input.amount,
    payout,
    multiplier,
    profit,
    serverSeed,
    serverSeedHash,
    clientSeed: input.clientSeed,
    nonce: input.nonce,
    createdAt: updated.placedAt.toISOString(),
  };
  return { betId: updated.id, result: dto };
};

export const verifyFairness = (
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: number,
  expectedRoll: number
): boolean => {
  const computedHash = hashServerSeed(serverSeed);
  if (computedHash !== serverSeedHash) return false;
  const roll = deriveRoll(serverSeed, clientSeed, nonce);
  return Math.abs(roll - expectedRoll) < 0.0001;
};

export const listGames = async (
  prisma: import("@nova/database").PrismaClient,
  category?: GameCategory
): Promise<Game[]> => {
  const rows = await prisma.game.findMany({
    where: { enabled: true, ...(category ? { category } : {}) },
  });
  return rows.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    category: g.category,
    rtp: Number(g.rtp.toString()),
    houseEdge: Number(g.houseEdge.toString()),
    isLive: g.isLive,
    thumbnail: g.thumbnailUrl ?? "/games/placeholder.png",
  }));
};

export const issueSeeds = (clientSeed: string): ProvablyFairSeedPair => {
  const serverSeed = newServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  return { serverSeedHash, clientSeed, nonce: Date.now() };
};

export const gameConstants = {
  HOUSE_EDGE_BPS,
  MIN_BET,
  MAX_BET,
} as const;
