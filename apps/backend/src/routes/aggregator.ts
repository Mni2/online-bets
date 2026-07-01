import type { FastifyInstance } from "fastify";
import {
  AGGREGATED_VENDORS,
  filterCatalog,
  getAggregatorStats,
  launchAggregatedGame,
  type AggregatorFilter,
} from "@nova/games";
import { requireAuth } from "../plugins/auth.js";

export const aggregatorRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/catalog", async (req) => {
    const query = req.query as AggregatorFilter;
    const games = filterCatalog(query);
    return {
      vendors: AGGREGATED_VENDORS,
      games,
      count: games.length,
    };
  });

  app.get("/stats", async () => {
    return getAggregatorStats();
  });

  app.post("/launch", async (req, reply) => {
    const auth = requireAuth(req);
    const body = req.body as { slug: string; currency?: string };
    if (!body?.slug) return reply.code(400).send({ error: { code: "missing_slug", message: "Game slug required" } });
    try {
      const res = launchAggregatedGame(body.slug, auth.sub, body.currency ?? "USD");
      return res;
    } catch (err) {
      return reply.code(400).send({ error: { code: "launch_failed", message: (err as Error).message } });
    }
  });
};
