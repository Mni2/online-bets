import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import { lockFunds, settleFunds } from "@nova/wallet";
import {
  issueSeeds,
  listGames,
  playDice,
  startRound,
} from "@nova/games";
import { requireAuth } from "../plugins/auth.js";

const categorySchema = {
  type: "string" as const,
  enum: ["dice", "crash", "slots", "roulette", "blackjack", "live", "sports"],
};

const diceBetBody = {
  type: "object" as const,
  required: ["amount", "currency", "target", "direction", "clientSeed", "nonce"],
  properties: {
    amount: { type: "string" as const, pattern: "^\\d+(\\.\\d{1,8})?$" },
    currency: { type: "string" as const, enum: ["USD", "EUR", "GBP", "BTC", "ETH", "USDT"] },
    target: { type: "number" as const, minimum: 2, maximum: 98 },
    direction: { type: "string" as const, enum: ["under", "over"] },
    clientSeed: { type: "string" as const, minLength: 1, maxLength: 64 },
    nonce: { type: "integer" as const, minimum: 0 },
    gameSlug: { type: "string" as const },
  },
  additionalProperties: false,
};

const seedsBody = {
  type: "object" as const,
  required: ["clientSeed"],
  properties: { clientSeed: { type: "string" as const, minLength: 1, maxLength: 64 } },
  additionalProperties: false,
};

const slugParams = {
  type: "object" as const,
  required: ["slug"],
  properties: { slug: { type: "string" as const } },
};

const categoryParams = {
  type: "object" as const,
  required: ["category"],
  properties: { category: categorySchema },
};

export const gameRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/", async () => listGames(prisma));

  app.get(
    "/category/:category",
    { schema: { params: categoryParams } },
    async (req) => {
      const { category } = req.params as any;
      return listGames(prisma, category);
    }
  );

  app.get(
    "/:slug",
    { schema: { params: slugParams } },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const game = await prisma.game.findUnique({ where: { slug } });
      if (!game) return reply.code(404).send({ error: { code: "not_found", message: "Game not found" } });
      return game;
    }
  );

  app.post(
    "/:slug/seeds",
    { schema: { params: slugParams, body: seedsBody } },
    async (req) => {
      const { slug } = req.params as { slug: string };
      const { clientSeed } = req.body as { clientSeed: string };
      const issued = issueSeeds(clientSeed);
      const round = await startRound(prisma, { gameSlug: slug, clientSeed });
      return { ...issued, roundId: round.roundId, serverSeedHash: round.serverSeedHash };
    }
  );

  app.post(
    "/dice/play",
    { schema: { body: diceBetBody } },
    async (req, reply) => {
      const auth = requireAuth(req);
      const body = req.body as any;
      try {
        const result = await playDice(
          prisma,
          lockFunds,
          settleFunds,
          {
            userId: auth.sub,
            gameSlug: body.gameSlug ?? "dice-100",
            amount: body.amount,
            currency: body.currency,
            target: body.target,
            direction: body.direction,
            clientSeed: body.clientSeed,
            nonce: body.nonce,
          }
        );
        return result;
      } catch (err) {
        const code = (err as Error).message;
        return reply.code(400).send({
          error: { code, message: code.replace(/_/g, " ") },
        });
      }
    }
  );

  app.get("/bets/me", async (req) => {
    const auth = requireAuth(req);
    const bets = await prisma.bet.findMany({
      where: { userId: auth.sub },
      orderBy: { placedAt: "desc" },
      take: 50,
    });
    return (bets as any[]).map((b) => ({
      id: b.id,
      gameId: b.gameId,
      amount: b.amount.toString(),
      payout: b.payout.toString(),
      profit: b.profit.toString(),
      multiplier: b.multiplier.toString(),
      status: b.status,
      result: b.result,
      placedAt: b.placedAt,
      settledAt: b.settledAt,
    }));
  });
};