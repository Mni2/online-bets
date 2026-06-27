import type { FastifyInstance, FastifyRequest } from "fastify";
import { verifyAccessToken, type TokenClaims } from "@nova/auth";
import type { Role } from "@nova/types";

declare module "fastify" {
  interface FastifyRequest {
    auth?: TokenClaims;
  }
}

export const registerAuthPreHandler = async (app: FastifyInstance): Promise<void> => {
  app.decorateRequest("auth", null);

  app.addHook("onRequest", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return;
    try {
      const claims = verifyAccessToken(header.slice(7));
      req.auth = claims;
    } catch {
      req.auth = undefined;
    }
  });
};

export const requireAuth = (req: FastifyRequest): TokenClaims => {
  if (!req.auth) {
    const err = new Error("unauthorized") as Error & { statusCode: number; code: string };
    err.statusCode = 401;
    err.code = "unauthorized";
    throw err;
  }
  return req.auth;
};

export const requireRole = (req: FastifyRequest, ...roles: Role[]): TokenClaims => {
  const auth = requireAuth(req);
  if (!roles.includes(auth.role) && auth.role !== "superadmin") {
    const err = new Error("forbidden") as Error & { statusCode: number; code: string };
    err.statusCode = 403;
    err.code = "forbidden";
    throw err;
  }
  return auth;
};
