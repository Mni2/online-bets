import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import { lockFunds, settleFunds } from "@nova/wallet";
import {
  FIXTURES,
  simulateInstantSportsBet,
  type SportsBetInput,
} from "@nova/games";
import { requireAuth } from "../plugins/auth.js";

const betBody = {
  type: "object" as const,
  required: ["fixtureSlug", "selection", "amount"],
  properties: {
    fixtureSlug: { type: "string" as const },
    selection: { type: "string" as const, enum: ["home", "draw", "away"] },
    amount: { type: "string" as const, pattern: "^\\d+(\\.\\d{1,8})?$" },
    currency: { type: "string" as const, enum: ["USD", "EUR", "GBP", "BTC", "ETH", "USDT"] },
  },
};

export const sportsRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/fixtures", async () => {
    return { fixtures: FIXTURES };
  });

  app.post("/bet", { schema: { body: betBody } }, async (req, reply) => {
    const auth = requireAuth(req);
    const body = req.body as Omit<SportsBetInput, "userId">;
    try {
      const res = await simulateInstantSportsBet(prisma, lockFunds, settleFunds, {
        ...body,
        userId: auth.sub,
        currency: body.currency ?? "USD",
      });
      return res;
    } catch (err) {
      const msg = (err as Error).message;
      return reply.code(400).send({ error: { code: msg, message: msg.replace(/_/g, " ") } });
    }
  });
};
