import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";

import { authRoutes } from "./routes/auth.js";
import { walletRoutes } from "./routes/wallet.js";
import { gameRoutes } from "./routes/games.js";
import { userRoutes } from "./routes/users.js";
import { adminRoutes } from "./routes/admin.js";
import { systemRoutes } from "./routes/system.js";
import { registerAuthPreHandler } from "./plugins/auth.js";
import { formatLog } from "@nova/shared";

export const buildServer = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? "").split(",").filter(Boolean),
    credentials: true,
  });
  await app.register(sensible);
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 10000,
    timeWindow: "1 minute",
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Nova Royale API",
        description: "Production online casino platform backend",
        version: "0.1.0",
      },
      servers: [{ url: process.env.BACKEND_PUBLIC_URL ?? "http://localhost:4000" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await registerAuthPreHandler(app);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Invalid request payload",
          details: err.flatten(),
        },
      });
    }
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    req.log.error(
      formatLog("error", "http", err.message, {
        stack: err.stack,
        path: req.url,
        method: req.method,
      })
    );
    return reply.code(statusCode).send({
      error: {
        code: (err as { code?: string }).code ?? "internal_error",
        message: statusCode >= 500 ? "Internal server error" : err.message,
      },
    });
  });

  await app.register(systemRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(walletRoutes, { prefix: "/api/wallet" });
  await app.register(gameRoutes, { prefix: "/api/games" });
  await app.register(adminRoutes, { prefix: "/api/admin" });

  return app;
};

if (process.env.SMOKE_TEST !== "1") {
  const start = async (): Promise<void> => {
    const app = await buildServer();
    const port = Number(process.env.BACKEND_PORT ?? 4000);
    const host = "0.0.0.0";
    try {
      await app.listen({ port, host });
      app.log.info(`Nova Royale API listening on http://${host}:${port}`);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  void start();
}