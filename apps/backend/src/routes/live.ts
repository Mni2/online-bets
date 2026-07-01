import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import { lockFunds, settleFunds } from "@nova/wallet";
import {
  LIVE_TABLES,
  generateLiveSession,
  handleProviderWebhook,
  simulateLiveRound,
  type LiveWebhookPayload,
} from "@nova/games";
import { requireAuth } from "../plugins/auth.js";

const sessionBody = {
  type: "object" as const,
  required: ["tableSlug"],
  properties: {
    tableSlug: { type: "string" as const },
    currency: { type: "string" as const, enum: ["USD", "EUR", "GBP", "BTC", "ETH", "USDT"] },
  },
};

const simulateBody = {
  type: "object" as const,
  required: ["tableSlug", "amount", "betType"],
  properties: {
    tableSlug: { type: "string" as const },
    amount: { type: "number" as const, minimum: 0.1 },
    betType: { type: "string" as const },
    currency: { type: "string" as const },
  },
};

export const liveRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/tables", async () => {
    return { tables: LIVE_TABLES };
  });

  app.post("/session", { schema: { body: sessionBody } }, async (req, reply) => {
    const auth = requireAuth(req);
    const body = req.body as { tableSlug: string; currency?: string };
    try {
      const session = generateLiveSession(body.tableSlug, auth.sub, body.currency ?? "USD");
      return session;
    } catch (err) {
      return reply.code(400).send({ error: { code: "session_error", message: (err as Error).message } });
    }
  });

  app.post("/simulate", { schema: { body: simulateBody } }, async (req, reply) => {
    const auth = requireAuth(req);
    const body = req.body as { tableSlug: string; amount: number; betType: string; currency?: string };
    try {
      const currency = (body.currency ?? "USD") as any;
      const amountStr = body.amount.toString();
      
      const roundId = randomBytes(16).toString("hex");

      // Step 1: Lock wager
      await lockFunds({
        userId: auth.sub,
        amount: amountStr,
        currency,
        referenceType: "live_bet",
        referenceId: roundId,
      });

      // Step 2: Execute 80% RTP live studio simulation
      const sim = simulateLiveRound(body.tableSlug, body.amount, body.betType);

      // Step 3: Settle winnings
      await settleFunds({
        userId: auth.sub,
        betAmount: amountStr,
        payout: sim.payout.toString(),
        currency,
        referenceType: "live_settle",
        referenceId: roundId,
      });

      return {
        betId: roundId,
        won: sim.won,
        multiplier: sim.multiplier,
        payout: sim.payout,
        profit: sim.profit,
        dealerMessage: sim.dealerMessage,
        outcome: sim.outcome,
      };
    } catch (err) {
      const msg = (err as Error).message;
      return reply.code(400).send({ error: { code: msg, message: msg.replace(/_/g, " ") } });
    }
  });

  app.post("/webhook/:provider", async (req, reply) => {
    const { provider } = req.params as { provider: string };
    const payload = req.body as LiveWebhookPayload;
    try {
      const res = await handleProviderWebhook(provider, payload, prisma, lockFunds, settleFunds);
      return res;
    } catch (err) {
      return reply.code(400).send({ status: "ERROR", message: (err as Error).message });
    }
  });
};
