import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import { requireRole } from "../plugins/auth.js";

const usersQuerySchema = {
  type: "object" as const,
  properties: {
    q: { type: "string" as const },
    page: { type: "integer" as const, minimum: 1, default: 1 },
    pageSize: { type: "integer" as const, minimum: 1, maximum: 100, default: 20 },
  },
};

const transactionsQuerySchema = {
  type: "object" as const,
  properties: {
    page: { type: "integer" as const, minimum: 1, default: 1 },
    pageSize: { type: "integer" as const, minimum: 1, maximum: 100, default: 20 },
  },
};

const kycReviewParamsSchema = {
  type: "object" as const,
  required: ["id"],
  properties: { id: { type: "string" as const, format: "uuid" } },
};

const kycReviewBodySchema = {
  type: "object" as const,
  required: ["decision"],
  properties: {
    decision: { type: "string" as const, enum: ["approved", "rejected"] },
    note: { type: "string" as const, maxLength: 500 },
  },
  additionalProperties: false,
};

export const adminRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/overview", async (req) => {
    requireRole(req, "admin");
    const [users, bets, deposits, withdrawals, kycPending] = await Promise.all([
      prisma.user.count(),
      prisma.bet.count(),
      prisma.paymentTransaction.count({ where: { method: { in: ["stripe", "coinbase"] } } }),
      prisma.paymentTransaction.count({ where: { status: "pending", method: "manual" } }),
      prisma.kycDocument.count({ where: { status: "pending" } }),
    ]);
    const totalWagered = await prisma.bet.aggregate({ _sum: { amount: true } });
    const totalPaid = await prisma.bet.aggregate({ _sum: { payout: true } });
    return {
      users,
      bets,
      deposits,
      withdrawals,
      kycPending,
      totalWagered: (totalWagered as any)._sum?.amount?.toString?.() ?? "0",
      totalPaid: (totalPaid as any)._sum?.payout?.toString?.() ?? "0",
    };
  });

  app.get(
    "/users",
    { schema: { querystring: usersQuerySchema } },
    async (req) => {
      requireRole(req, "admin");
      const q = req.query as { q?: string; page: number; pageSize: number };
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 20;
      const where: any = q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: "insensitive" } },
              { username: { contains: q.q, mode: "insensitive" } },
              { displayName: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {};
      const [rows, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { wallets: true },
        }),
        prisma.user.count({ where }),
      ]);
      return {
        items: (rows as any[]).map((u) => ({
          id: u.id,
          email: u.email,
          username: u.username,
          displayName: u.displayName,
          role: u.role,
          kycStatus: u.kycStatus,
          createdAt: u.createdAt,
          balances: (u.wallets ?? []).map((w: any) => ({
            currency: w.currency,
            balance: w.balance.toString(),
            locked: w.locked.toString(),
          })),
        })),
        page,
        pageSize,
        total,
      };
    }
  );

  app.get(
    "/transactions",
    { schema: { querystring: transactionsQuerySchema } },
    async (req) => {
      requireRole(req, "admin");
      const q = req.query as { page: number; pageSize: number };
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 20;
      const [rows, total] = await Promise.all([
        prisma.paymentTransaction.findMany({
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.paymentTransaction.count(),
      ]);
      return { items: rows, page, pageSize, total };
    }
  );

  app.get("/kyc", async (req) => {
    requireRole(req, "admin");
    const docs = await prisma.kycDocument.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    });
    return (docs as any[]).map((d) => ({
      id: d.id,
      user: { id: d.user.id, email: d.user.email, username: d.user.username },
      type: d.type,
      storageKey: d.storageKey,
      createdAt: d.createdAt,
    }));
  });

  app.post(
    "/kyc/:id/review",
    { schema: { params: kycReviewParamsSchema, body: kycReviewBodySchema } },
    async (req) => {
      const auth = requireRole(req, "admin");
      const { id } = req.params as { id: string };
      const body = req.body as { decision: "approved" | "rejected"; note?: string };
      const updated = await prisma.kycDocument.update({
        where: { id },
        data: {
          status: body.decision,
          reviewedAt: new Date(),
          reviewedById: auth.sub,
          reviewNote: body.note,
        },
      });
      if (body.decision === "approved") {
        await prisma.user.update({
          where: { id: (updated as any).userId },
          data: { kycStatus: "approved" },
        });
      } else {
        await prisma.user.update({
          where: { id: (updated as any).userId },
          data: { kycStatus: "rejected" },
        });
      }
      return { id: (updated as any).id, status: (updated as any).status };
    }
  );
};