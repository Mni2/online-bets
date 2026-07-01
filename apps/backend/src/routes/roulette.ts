import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { deriveRouletteNumber, evaluateRouletteBet } from "@nova/games";
import type { RouletteSingleBet } from "@nova/games";
import { lockFunds, settleFunds } from "@nova/wallet";
import { prisma } from "@nova/database";
import { createHmac, randomBytes } from "node:crypto";
import { addDecimal, ZERO } from "@nova/shared";

// ─── Roulette number color lookup ────────────────────────────────────────────
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

function getColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

// ─── Bet validation ──────────────────────────────────────────────────────────
function validateBets(bets: RouletteSingleBet[]): void {
  if (!bets || bets.length === 0) throw new Error("no_bets_placed");
  if (bets.length > 50) throw new Error("too_many_bets");

  for (const bet of bets) {
    if (!bet.numbers || bet.numbers.length === 0) throw new Error("invalid_bet_numbers");
    for (const n of bet.numbers) {
      if (!Number.isInteger(n) || n < 0 || n > 36) throw new Error("invalid_number_range");
    }
    const amt = parseFloat(bet.amount);
    if (isNaN(amt) || amt < 0.10 || amt > 10000) throw new Error("invalid_bet_amount");
  }
}

// ─── In-memory recent spin history (per server instance) ─────────────────────
const recentSpins: Array<{ number: number; color: string }> = [];
const MAX_HISTORY = 50;

// ─── Schema definition ──────────────────────────────────────────────────────
const rouletteBetSchema = {
  type: "object" as const,
  required: ["bets", "currency"],
  properties: {
    bets: {
      type: "array" as const,
      items: {
        type: "object" as const,
        required: ["type", "numbers", "amount"],
        properties: {
          type: {
            type: "string" as const,
            enum: ["straight","split","street","corner","line","dozen","column","color","parity","highlow"],
          },
          numbers: { type: "array" as const, items: { type: "number" as const } },
          amount: { type: "string" as const, pattern: "^\\d+(\\.\\d{1,8})?$" },
        },
      },
    },
    currency: { type: "string" as const, enum: ["USD","EUR","GBP","BTC","ETH","USDT"] },
    clientSeed: { type: "string" as const },
  },
  additionalProperties: false,
};

export const rouletteRoutes = async (app: FastifyInstance): Promise<void> => {

  // ─── GET /history — recent spin results ──────────────────────────────────
  app.get("/history", async () => {
    return { history: recentSpins };
  });

  // ─── POST /play — place bets & spin ──────────────────────────────────────
  app.post(
    "/play",
    { schema: { body: rouletteBetSchema } },
    async (req, reply) => {
      const auth = requireAuth(req);
      const body = req.body as {
        bets: RouletteSingleBet[];
        currency: string;
        clientSeed?: string;
      };

      const { bets, currency } = body;

      // 1. Validate bets
      try {
        validateBets(bets);
      } catch (err) {
        return reply.code(400).send({
          error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
        });
      }

      // 2. Generate server seed & nonce
      const serverSeed = randomBytes(32).toString("hex");
      const serverSeedHash = createHmac("sha256", serverSeed).update("roulette").digest("hex");
      const clientSeed = body.clientSeed || `nova-roulette-${randomBytes(4).toString("hex")}`;
      const nonce = Date.now();

      // 3. Calculate total wager
      let totalWager = "0";
      for (const bet of bets) {
        totalWager = addDecimal(totalWager, bet.amount);
      }

      // 4. Lock funds from wallet
      const roundId = randomBytes(16).toString("hex");
      try {
        await lockFunds({
          userId: auth.sub,
          currency: currency as any,
          amount: totalWager,
          referenceType: "roulette_bet",
          referenceId: roundId,
        });
      } catch (err) {
        return reply.code(400).send({
          error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
        });
      }

      // 5. Derive winning number
      const winningNumber = deriveRouletteNumber(serverSeed, clientSeed, nonce);
      const winningColor = getColor(winningNumber);

      // 6. Evaluate each bet
      let totalPayout = "0";
      const results = bets.map((bet) => {
        const result = evaluateRouletteBet(bet, winningNumber);
        if (result.won) {
          totalPayout = addDecimal(totalPayout, result.payout);
        }
        return {
          type: bet.type,
          numbers: bet.numbers,
          amount: bet.amount,
          won: result.won,
          multiplier: result.multiplier,
          payout: result.payout,
        };
      });

      // 7. Settle funds
      try {
        await settleFunds({
          userId: auth.sub,
          currency: currency as any,
          betAmount: totalWager,
          payout: totalPayout,
          referenceType: "roulette_settle",
          referenceId: roundId,
        });
      } catch (err) {
        return reply.code(500).send({
          error: { code: "settlement_error", message: "Failed to settle roulette round" },
        });
      }

      // 8. Add to history
      recentSpins.unshift({ number: winningNumber, color: winningColor });
      if (recentSpins.length > MAX_HISTORY) recentSpins.pop();

      // 9. Return result
      return {
        roundId,
        winningNumber,
        winningColor,
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        totalWager,
        totalPayout,
        netResult: totalPayout === "0" ? `-${totalWager}` : addDecimal(totalPayout, `-${totalWager}`),
        bets: results,
      };
    }
  );
};
