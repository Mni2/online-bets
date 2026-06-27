import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import { BRAND } from "@nova/shared";

export const systemRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  app.get("/ready", async (req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch (err) {
      req.log.error({ err }, "readiness failed");
      return reply.code(503).send({ ready: false });
    }
  });

  app.get("/brand", async () => BRAND);
};
