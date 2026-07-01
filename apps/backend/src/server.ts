import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastifyWebsocket from "@fastify/websocket";
import { ZodError } from "zod";

import { authRoutes } from "./routes/auth.js";
import { walletRoutes } from "./routes/wallet.js";
import { gameRoutes } from "./routes/games.js";
import { crashRoutes } from "./routes/crash.js";
import { userRoutes } from "./routes/users.js";
import { adminRoutes } from "./routes/admin.js";
import { systemRoutes } from "./routes/system.js";
import { registerAuthPreHandler } from "./plugins/auth.js";
import { formatLog } from "@nova/shared";
import { CrashGameLoop } from "@nova/games";
import { prisma } from "@nova/database";
import { lockFunds, settleFunds } from "@nova/wallet";

declare module "fastify" {
  interface FastifyInstance {
    crashLoop: CrashGameLoop;
  }
}

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
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "").split(",").filter(Boolean);
  if (allowedOrigins.length === 0) {
    allowedOrigins.push(
      "https://frontend-five-chi-58.vercel.app",
      "https://admin-tau-lyart-31.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173"
    );
  }

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });
  await app.register(sensible);
  await app.register(cookie);
  await app.register(fastifyWebsocket);
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
  await app.register(crashRoutes, { prefix: "/api/games/crash" });
  await app.register(adminRoutes, { prefix: "/api/admin" });

  const crashLoop = new CrashGameLoop(
    prisma,
    (msg) => {
      // @ts-ignore
      const clients = app.websocketServer?.clients;
      if (clients) {
        const payloadStr = JSON.stringify(msg);
        for (const client of clients) {
          if (client.readyState === 1) { // OPEN
            client.send(payloadStr);
          }
        }
      }
    },
    lockFunds,
    settleFunds
  );
  
  if (process.env.SMOKE_TEST !== "1") {
    await crashLoop.start();
  }
  
  app.decorate("crashLoop", crashLoop);

  return app;
};

if (process.env.SMOKE_TEST !== "1") {
  const start = async (): Promise<void> => {
    const app = await buildServer();
    const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 4000);
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