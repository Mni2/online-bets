import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import { requireAuth } from "../plugins/auth.js";

const patchMeBody = {
  type: "object" as const,
  properties: {
    displayName: { type: "string" as const, minLength: 1, maxLength: 40 },
    countryCode: { type: "string" as const, minLength: 2, maxLength: 2 },
  },
  additionalProperties: false,
};

export const userRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/me", async (req) => {
    const auth = requireAuth(req);
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      include: { wallets: true, vipProfile: true },
    });
    if (!user) throw new Error("user_not_found");
    return {
      id: (user as any).id,
      email: (user as any).email,
      username: (user as any).username,
      displayName: (user as any).displayName,
      role: (user as any).role,
      kycStatus: (user as any).kycStatus,
      createdAt: (user as any).createdAt,
      vip: (user as any).vipProfile,
      wallets: ((user as any).wallets ?? []).map((w: any) => ({
        currency: w.currency,
        balance: w.balance.toString(),
        locked: w.locked.toString(),
        bonusBalance: w.bonusBalance.toString(),
      })),
    };
  });

  app.patch("/me", { schema: { body: patchMeBody } }, async (req) => {
    const auth = requireAuth(req);
    const body = req.body as { displayName?: string; countryCode?: string };
    const updated = await prisma.user.update({
      where: { id: auth.sub },
      data: {
        ...(body.displayName ? { displayName: body.displayName } : {}),
        ...(body.countryCode ? { countryCode: body.countryCode } : {}),
      },
    });
    return {
      id: (updated as any).id,
      displayName: (updated as any).displayName,
      countryCode: (updated as any).countryCode,
    };
  });

  app.get("/me/sessions", async (req) => {
    const auth = requireAuth(req);
    const sessions = await prisma.session.findMany({
      where: { userId: auth.sub },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return (sessions as any[]).map((s) => ({
      id: s.id,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
    }));
  });
};