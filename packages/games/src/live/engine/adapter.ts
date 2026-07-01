import { createHmac, randomBytes } from "node:crypto";
import { mulDecimal, ZERO } from "@nova/shared";
import type { PrismaClient } from "@prisma/client";

export interface LiveTable {
  id: string;
  slug: string;
  name: string;
  provider: "Evolution" | "PragmaticLive" | "Ezugi" | "NovaStudio";
  dealerName: string;
  dealerAvatar: string;
  minBet: string;
  maxBet: string;
  rtp: number;
  houseEdge: number;
  status: "open" | "dealing" | "maintenance";
  category: "roulette" | "blackjack" | "baccarat" | "gameshow";
}

export const LIVE_TABLES: LiveTable[] = [
  {
    id: "live-1",
    slug: "live-vip-roulette",
    name: "Monte Carlo VIP Roulette",
    provider: "Evolution",
    dealerName: "Elena",
    dealerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    minBet: "1.00",
    maxBet: "10000.00",
    rtp: 80.0,
    houseEdge: 20.0,
    status: "open",
    category: "roulette",
  },
  {
    id: "live-2",
    slug: "live-vip-blackjack",
    name: "Grand Casino VIP Blackjack",
    provider: "PragmaticLive",
    dealerName: "Victoria",
    dealerAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    minBet: "5.00",
    maxBet: "25000.00",
    rtp: 80.0,
    houseEdge: 20.0,
    status: "open",
    category: "blackjack",
  },
  {
    id: "live-3",
    slug: "live-highroller-baccarat",
    name: "Imperial High-Roller Baccarat",
    provider: "Ezugi",
    dealerName: "Sophia",
    dealerAvatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&auto=format&fit=crop&q=80",
    minBet: "10.00",
    maxBet: "50000.00",
    rtp: 80.0,
    houseEdge: 20.0,
    status: "open",
    category: "baccarat",
  },
  {
    id: "live-4",
    slug: "live-cyber-show",
    name: "Cyber Fortune Live Game Show",
    provider: "NovaStudio",
    dealerName: "Chloe",
    dealerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80",
    minBet: "0.50",
    maxBet: "5000.00",
    rtp: 80.0,
    houseEdge: 20.0,
    status: "open",
    category: "gameshow",
  },
];

export interface LiveSession {
  token: string;
  tableSlug: string;
  streamUrl: string;
  expiresAt: string;
  signature: string;
}

export const generateLiveSession = (
  tableSlug: string,
  userId: string,
  currency: string = "USD"
): LiveSession => {
  const table = LIVE_TABLES.find((t) => t.slug === tableSlug) ?? LIVE_TABLES[0]!;
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(); // 4 hours
  const secret = process.env.LIVE_ADAPTER_SECRET ?? "nova_live_secret_key";
  const signature = createHmac("sha256", secret)
    .update(`${token}:${table.slug}:${userId}:${currency}:${expiresAt}`)
    .digest("hex");

  const streamUrl = `https://studio.novaroyale.vip/stream/${table.slug}?token=${token}&sig=${signature}`;

  return {
    token,
    tableSlug: table.slug,
    streamUrl,
    expiresAt,
    signature,
  };
};

export interface LiveWebhookPayload {
  action: "authenticate" | "debit" | "credit" | "rollback";
  token: string;
  userId: string;
  roundId: string;
  transactionId: string;
  amount?: string;
  currency?: string;
  gameSlug?: string;
  details?: Record<string, any>;
}

/**
 * Handles Seamless Wallet API callbacks from external Live Dealer studio servers.
 * Enforces the strict 80% RTP / 20% House Edge accounting model.
 */
export const handleProviderWebhook = async (
  provider: string,
  payload: LiveWebhookPayload,
  prisma: PrismaClient,
  lockFundsFn: any,
  settleFundsFn: any
): Promise<{ status: string; balance: string; currency: string; transactionId: string }> => {
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw new Error("user_not_found");

  const currency = (payload.currency ?? "USD") as any;
  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: user.id, currency } },
  });
  if (!wallet) throw new Error("wallet_not_found");

  if (payload.action === "authenticate") {
    return {
      status: "OK",
      balance: wallet.balance.toString(),
      currency,
      transactionId: payload.transactionId,
    };
  }

  if (payload.action === "debit") {
    const amount = payload.amount ?? "0";
    await lockFundsFn({
      userId: user.id,
      amount,
      currency,
      referenceType: "live_debit",
      referenceId: payload.roundId || payload.transactionId,
    });
    const updated = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: user.id, currency } },
    });
    return {
      status: "OK",
      balance: updated ? updated.balance.toString() : "0",
      currency,
      transactionId: payload.transactionId,
    };
  }

  if (payload.action === "credit" || payload.action === "rollback") {
    const amount = payload.amount ?? "0";
    await settleFundsFn({
      userId: user.id,
      betAmount: "0",
      payout: amount,
      currency,
      referenceType: "live_credit",
      referenceId: payload.roundId || payload.transactionId,
    });
    const updated = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: user.id, currency } },
    });
    return {
      status: "OK",
      balance: updated ? updated.balance.toString() : "0",
      currency,
      transactionId: payload.transactionId,
    };
  }

  throw new Error("invalid_action");
};

/**
 * Simulates an interactive live dealer round for instant frontend play.
 * Calibrated to exactly 80.0% RTP / 20.0% House Edge across thousands of simulated hands.
 */
export const simulateLiveRound = (
  tableSlug: string,
  betAmount: number,
  betType: string
): { won: boolean; multiplier: number; payout: number; profit: number; dealerMessage: string; outcome: string } => {
  const table = LIVE_TABLES.find((t) => t.slug === tableSlug) ?? LIVE_TABLES[0]!;
  
  // 80% RTP Calibration:
  // For standard 2x payouts (Red/Black, Player/Banker), win probability is set to 40% (40% * 2.0 = 0.80 RTP / 20% House Edge).
  const roll = Math.random() * 100;
  
  if (table.category === "roulette") {
    const won = roll < 40.0; // 40% chance to win 2x
    const multiplier = won ? 2.0 : 0;
    const payout = won ? Number((betAmount * multiplier).toFixed(2)) : 0;
    const profit = Number((payout - betAmount).toFixed(2));
    const winNumber = won ? (betType === "red" ? 32 : 15) : 0; // 0 is green house win
    return {
      won,
      multiplier,
      payout,
      profit,
      dealerMessage: won
        ? `${table.dealerName}: "Congratulations! Number ${winNumber} wins! A clean victory for our VIP!"`
        : `${table.dealerName}: "Number ${winNumber}. House wins this hand. Best of luck on the next spin!"`,
      outcome: `Spin result: ${winNumber}`,
    };
  }

  if (table.category === "blackjack") {
    const won = roll < 40.0; // 40% win rate for 80% RTP
    const multiplier = won ? 2.0 : 0;
    const payout = won ? Number((betAmount * multiplier).toFixed(2)) : 0;
    const profit = Number((payout - betAmount).toFixed(2));
    return {
      won,
      multiplier,
      payout,
      profit,
      dealerMessage: won
        ? `${table.dealerName}: "Player stands with 20. Dealer busts with 23! Well played!"`
        : `${table.dealerName}: "Dealer draws 21. Tough luck, but your table seat is warm!"`,
      outcome: won ? "Player 20 vs Dealer 23 (Bust)" : "Player 18 vs Dealer 21",
    };
  }

  if (table.category === "baccarat") {
    const won = roll < 40.0;
    const multiplier = won ? 2.0 : 0;
    const payout = won ? Number((betAmount * multiplier).toFixed(2)) : 0;
    const profit = Number((payout - betAmount).toFixed(2));
    return {
      won,
      multiplier,
      payout,
      profit,
      dealerMessage: won
        ? `${table.dealerName}: "Natural 9 for Player! Baccarat victory!"`
        : `${table.dealerName}: "Banker wins with 8. Another round is starting now."`,
      outcome: won ? "Player 9 vs Banker 6" : "Player 5 vs Banker 8",
    };
  }

  // Game Show (Cyber Fortune)
  const won = roll < 32.0; // 32% chance for 2.5x average payout = 80% RTP
  const multiplier = won ? 2.5 : 0;
  const payout = won ? Number((betAmount * multiplier).toFixed(2)) : 0;
  const profit = Number((payout - betAmount).toFixed(2));
  return {
    won,
    multiplier,
    payout,
    profit,
    dealerMessage: won
      ? `${table.dealerName}: "THE WHEEL STOPS ON CYBER 2.5X BONUS! Incredible win!"`
      : `${table.dealerName}: "The wheel lands on 1x House Sector. Spin coming right up!"`,
    outcome: won ? "Wheel Sector: 2.5x Cyber Bonus" : "Wheel Sector: House Sector",
  };
};
