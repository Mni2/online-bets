import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import { getOrCreateWallet, listWallets, recordEntry } from "@nova/wallet";
import { requireAuth } from "../plugins/auth.js";

const currencySchema = { type: "string" as const, enum: ["USD", "EUR", "GBP", "BTC", "ETH", "USDT"] };

const ensureBody = {
  type: "object" as const,
  required: ["currency"],
  properties: { currency: currencySchema },
  additionalProperties: false,
};

const depositBody = {
  type: "object" as const,
  required: ["currency", "amount", "method"],
  properties: {
    currency: currencySchema,
    amount: { type: "string" as const, pattern: "^\\d+(\\.\\d{1,8})?$" },
    method: { type: "string" as const, enum: ["stripe", "coinbase", "manual"] },
  },
  additionalProperties: false,
};

const withdrawBody = {
  type: "object" as const,
  required: ["currency", "amount", "destination"],
  properties: {
    currency: currencySchema,
    amount: { type: "string" as const, pattern: "^\\d+(\\.\\d{1,8})?$" },
    destination: { type: "string" as const, minLength: 4 },
  },
  additionalProperties: false,
};

const paginationQS = {
  type: "object" as const,
  properties: {
    page: { type: "integer" as const, minimum: 1, default: 1 },
    pageSize: { type: "integer" as const, minimum: 1, maximum: 100, default: 20 },
  },
};

export const walletRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/", async (req) => {
    const auth = requireAuth(req);
    return listWallets(auth.sub);
  });

  app.post("/ensure", { schema: { body: ensureBody } }, async (req) => {
    const auth = requireAuth(req);
    const body = req.body as any;
    return getOrCreateWallet({ userId: auth.sub, currency: body.currency });
  });

  app.post("/deposit", { schema: { body: depositBody } }, async (req, reply) => {
    const auth = requireAuth(req);
    const body = req.body as any;
    const wallet = await getOrCreateWallet({ userId: auth.sub, currency: body.currency });
    const amount = body.amount;
    if (Number(amount) <= 0) {
      return reply.code(400).send({
        error: { code: "invalid_amount", message: "Amount must be greater than 0" },
      });
    }
    const tx = await prisma.paymentTransaction.create({
      data: {
        walletId: wallet.id,
        method: body.method,
        status: "completed",
        currency: body.currency,
        amount,
        fee: "0",
        net: amount,
        completedAt: new Date(),
      } as any,
    });
    const entry = await recordEntry({
      userId: auth.sub,
      currency: body.currency,
      type: "deposit",
      amount,
      referenceType: "payment_transaction",
      referenceId: tx.id,
      idempotencyKey: `deposit:${tx.id}`,
    });
    return { transaction: tx, ledger: entry };
  });

  app.post("/withdraw", { schema: { body: withdrawBody } }, async (req, reply) => {
    const auth = requireAuth(req);
    const body = req.body as any;
    const wallet = await getOrCreateWallet({ userId: auth.sub, currency: body.currency });
    const balance = Number(wallet.balance);
    if (balance < Number(body.amount)) {
      return reply.code(400).send({
        error: { code: "insufficient_funds", message: "Not enough funds" },
      });
    }
    const tx = await prisma.paymentTransaction.create({
      data: {
        walletId: wallet.id,
        method: "manual",
        status: "pending",
        currency: body.currency,
        amount: body.amount,
        fee: "0",
        net: body.amount,
        externalPayload: { destination: body.destination },
      } as any,
    });
    const entry = await recordEntry({
      userId: auth.sub,
      currency: body.currency,
      type: "withdrawal",
      amount: `-${body.amount}`,
      referenceType: "payment_transaction",
      referenceId: tx.id,
      idempotencyKey: `withdraw:${tx.id}`,
    });
    return { transaction: tx, ledger: entry };
  });

  app.get("/history", { schema: { querystring: paginationQS } }, async (req) => {
    const auth = requireAuth(req);
    const q = req.query as { page: number; pageSize: number };
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const wallets = await prisma.wallet.findMany({ where: { userId: auth.sub } });
    const walletIds = wallets.map((w: any) => w.id);
    const [rows, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: { walletId: { in: walletIds } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ledgerEntry.count({ where: { walletId: { in: walletIds } } }),
    ]);
    return {
      items: (rows as any[]).map((r) => ({
        id: r.id,
        walletId: r.walletId,
        type: r.type,
        amount: r.amount.toString(),
        balanceAfter: r.balanceAfter.toString(),
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        createdAt: r.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  });
};