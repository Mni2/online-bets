import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { deriveSlotReels, evaluateSlotSpin } from "@nova/games";
import { lockFunds, settleFunds } from "@nova/wallet";
import { randomBytes, createHmac } from "node:crypto";
import { addDecimal, mulDecimal, ZERO } from "@nova/shared";

const slotSpinBody = {
  type: "object" as const,
  required: ["betPerLine", "currency"],
  properties: {
    betPerLine: { type: "string" as const, pattern: "^\\d+(\\.\\d{1,8})?$" },
    currency: { type: "string" as const, enum: ["USD", "EUR", "GBP", "BTC", "ETH", "USDT"] },
    lines: { type: "number" as const, minimum: 1, maximum: 20 },
    clientSeed: { type: "string" as const },
  },
  additionalProperties: false,
};

export const slotsRoutes = async (app: FastifyInstance): Promise<void> => {

  // ─── GET /info — game info ─────────────────────────────────────────────────
  app.get("/info", async () => {
    return {
      name: "Nova Slots",
      reels: 5,
      rows: 3,
      maxPaylines: 20,
      rtp: 80.0,
      houseEdge: 20.0,
      symbols: ["🍒", "🍋", "🍊", "🍇", "🔔", "⭐", "💎", "7️⃣", "🃏"],
      wildSymbol: "🃏",
    };
  });

  // ─── POST /spin — spin the reels ──────────────────────────────────────────
  app.post(
    "/spin",
    { schema: { body: slotSpinBody } },
    async (req, reply) => {
      const auth = requireAuth(req);
      const body = req.body as {
        betPerLine: string;
        currency: string;
        lines?: number;
        clientSeed?: string;
      };

      const lines = body.lines ?? 20;
      const betPerLine = body.betPerLine;

      // Validate bet
      const lineAmt = parseFloat(betPerLine);
      if (isNaN(lineAmt) || lineAmt < 0.01 || lineAmt > 500) {
        return reply.code(400).send({ error: { code: "invalid_bet", message: "Bet per line must be $0.01 - $500" } });
      }

      // Total wager = betPerLine × active lines
      const totalWager = mulDecimal(betPerLine, lines.toString());

      // Generate seeds
      const serverSeed = randomBytes(32).toString("hex");
      const serverSeedHash = createHmac("sha256", serverSeed).update("slots").digest("hex");
      const clientSeed = body.clientSeed || `nova-slots-${randomBytes(4).toString("hex")}`;
      const nonce = Date.now();
      const roundId = randomBytes(16).toString("hex");

      // Lock funds
      try {
        await lockFunds({
          userId: auth.sub,
          currency: body.currency as any,
          amount: totalWager,
          referenceType: "slots_bet",
          referenceId: roundId,
        });
      } catch (err) {
        return reply.code(400).send({
          error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
        });
      }

      // Derive reels & evaluate
      const reels = deriveSlotReels(serverSeed, clientSeed, nonce);
      const result = evaluateSlotSpin(reels, betPerLine, lines);

      // Settle
      try {
        await settleFunds({
          userId: auth.sub,
          currency: body.currency as any,
          betAmount: totalWager,
          payout: result.totalPayout,
          referenceType: "slots_settle",
          referenceId: roundId,
        });
      } catch (err) {
        return reply.code(500).send({ error: { code: "settlement_error", message: "Failed to settle slot spin" } });
      }

      return {
        roundId,
        reels: result.reels,
        paylines: result.paylines,
        totalMultiplier: result.totalMultiplier,
        totalWager,
        totalPayout: result.totalPayout,
        lines,
        betPerLine,
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
      };
    }
  );
};
