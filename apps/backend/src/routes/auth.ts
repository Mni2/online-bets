import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import {
  authenticate,
  hashPassword,
  isPasswordStrong,
  logout,
  refreshSession,
} from "@nova/auth";

const registerBodySchema = {
  type: "object" as const,
  required: ["email", "username", "password", "displayName", "acceptTos", "acceptAge"],
  properties: {
    email: { type: "string" as const, format: "email", minLength: 3 },
    username: { type: "string" as const, minLength: 3, maxLength: 24, pattern: "^[a-zA-Z0-9_]+$" },
    password: { type: "string" as const, minLength: 8, maxLength: 128 },
    displayName: { type: "string" as const, minLength: 1, maxLength: 40 },
    acceptTos: { type: "boolean" as const, enum: [true] },
    acceptAge: { type: "boolean" as const, enum: [true] },
    referralCode: { type: "string" as const },
  },
  additionalProperties: false,
};

const loginBodySchema = {
  type: "object" as const,
  required: ["identifier", "password"],
  properties: {
    identifier: { type: "string" as const, minLength: 3 },
    password: { type: "string" as const, minLength: 8, maxLength: 128 },
  },
  additionalProperties: false,
};

const refreshBodySchema = {
  type: "object" as const,
  required: ["refreshToken"],
  properties: { refreshToken: { type: "string" as const } },
  additionalProperties: false,
};

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post(
    "/register",
    { schema: { body: registerBodySchema } },
    async (req, reply) => {
      const body = req.body as any;
      if (!isPasswordStrong(body.password)) {
        return reply.code(400).send({
          error: { code: "weak_password", message: "Password too weak" },
        });
      }
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ email: body.email.toLowerCase() }, { username: body.username }],
        },
      });
      if (existing) {
        return reply.code(409).send({
          error: { code: "user_exists", message: "Email or username already registered" },
        });
      }
      const passwordHash = await hashPassword(body.password);
      const user = await prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          username: body.username,
          displayName: body.displayName,
          passwordHash,
          referralCode: body.referralCode ?? null,
        },
      });
      if (body.referralCode) {
        const referrer = await prisma.user.findFirst({ where: { referralCode: body.referralCode } });
        if (referrer) {
          await prisma.referral.create({
            data: {
              referrerId: referrer.id,
              referredId: user.id,
              code: body.referralCode,
            },
          });
        }
      }
      const result = await authenticate({
        identifier: body.email,
        password: body.password,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? "",
      });
      return reply.send(result);
    }
  );

  app.post(
    "/login",
    { schema: { body: loginBodySchema } },
    async (req, reply) => {
      const body = req.body as any;
      try {
        const result = await authenticate({
          identifier: body.identifier,
          password: body.password,
          ip: req.ip,
          userAgent: req.headers["user-agent"] ?? "",
        });
        return reply.send(result);
      } catch {
        return reply.code(401).send({
          error: { code: "invalid_credentials", message: "Invalid credentials" },
        });
      }
    }
  );

  app.post(
    "/refresh",
    { schema: { body: refreshBodySchema } },
    async (req, reply) => {
      const body = req.body as { refreshToken: string };
      try {
        const result = await refreshSession(body.refreshToken);
        return reply.send(result);
      } catch {
        return reply.code(401).send({
          error: { code: "invalid_refresh", message: "Refresh token rejected" },
        });
      }
    }
  );

  app.post(
    "/logout",
    { schema: { body: refreshBodySchema } },
    async (req) => {
      const body = req.body as { refreshToken: string };
      await logout(body.refreshToken);
      return { ok: true };
    }
  );
};