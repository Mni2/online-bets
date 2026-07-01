import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { verifyAccessToken } from "@nova/auth";

const crashBetBody = {
  type: "object" as const,
  required: ["amount", "currency"],
  properties: {
    amount: { type: "string" as const, pattern: "^\\d+(\\.\\d{1,8})?$" },
    currency: { type: "string" as const, enum: ["USD", "EUR", "GBP", "BTC", "ETH", "USDT"] },
    autoCashout: { type: "number" as const, minimum: 1.01, maximum: 100000 },
  },
  additionalProperties: false,
};

export const crashRoutes = async (app: FastifyInstance): Promise<void> => {
  // REST endpoint to get current Crash round state
  app.get("/state", async () => {
    return app.crashLoop.getState();
  });

  // REST endpoint to place a bet
  app.post(
    "/bet",
    { schema: { body: crashBetBody } },
    async (req, reply) => {
      const auth = requireAuth(req);
      const { amount, currency, autoCashout } = req.body as {
        amount: string;
        currency: string;
        autoCashout?: number;
      };

      try {
        await app.crashLoop.queueBet({
          userId: auth.sub,
          username: auth.username,
          amount,
          currency,
          autoCashout,
        });
        return { success: true };
      } catch (err) {
        return reply.code(400).send({
          error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
        });
      }
    }
  );

  // REST endpoint to cancel a queued bet
  app.post("/cancel-bet", async (req, reply) => {
    const auth = requireAuth(req);
    try {
      app.crashLoop.cancelQueuedBet(auth.sub);
      return { success: true };
    } catch (err) {
      return reply.code(400).send({
        error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
      });
    }
  });

  // REST endpoint to manually cash out
  app.post("/cashout", async (req, reply) => {
    const auth = requireAuth(req);
    try {
      const session = await app.crashLoop.cashoutBet(auth.sub);
      return { success: true, multiplier: session.cashoutMultiplier, payout: session.payout };
    } catch (err) {
      return reply.code(400).send({
        error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
      });
    }
  });

  // WebSocket sync route
  app.get(
    "/ws",
    { websocket: true },
    async (connection, req: FastifyRequest) => {
      // Validate token from query string
      const token = (req.query as { token?: string }).token;
      let authenticatedUser: { sub: string; username: string } | null = null;

      if (token) {
        try {
          const claims = verifyAccessToken(token);
          authenticatedUser = { sub: claims.sub, username: claims.username };
        } catch {
          // Keep connection open but unauthenticated (spectator mode)
        }
      }

      // Send initial state sync to the connecting socket
      connection.socket.send(
        JSON.stringify({
          type: "CRASH_STATE",
          payload: {
            ...app.crashLoop.getState(),
            user: authenticatedUser,
          },
        })
      );

      // Handle incoming messages from client
      connection.socket.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          if (msg.type === "PLACE_BET" && authenticatedUser) {
            const { amount, currency, autoCashout } = msg.payload;
            await app.crashLoop.queueBet({
              userId: authenticatedUser.sub,
              username: authenticatedUser.username,
              amount,
              currency,
              autoCashout,
            });
          } else if (msg.type === "CASHOUT" && authenticatedUser) {
            await app.crashLoop.cashoutBet(authenticatedUser.sub);
          }
        } catch (err) {
          connection.socket.send(
            JSON.stringify({
              type: "ERROR",
              payload: { message: (err as Error).message },
            })
          );
        }
      });
    }
  );
};
