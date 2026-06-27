import { prisma, type Currency, type Prisma, type LedgerEntryType } from "@nova/database";
import {
  ZERO,
  addDecimal,
  compareDecimal,
  subDecimal,
  toMinor,
} from "@nova/shared";
import type { Wallet as WalletDTO, WalletLedgerEntry as LedgerDTO } from "@nova/types";

const toDto = (w: {
  id: string;
  userId: string;
  currency: Currency;
  balance: import("@prisma/client/runtime/library").Decimal;
  locked: import("@prisma/client/runtime/library").Decimal;
  bonusBalance: import("@prisma/client/runtime/library").Decimal;
  updatedAt: Date;
}): WalletDTO => ({
  id: w.id,
  userId: w.userId,
  currency: w.currency,
  balance: w.balance.toString(),
  locked: w.locked.toString(),
  bonusBalance: w.bonusBalance.toString(),
  updatedAt: w.updatedAt.toISOString(),
});

const ledgerDto = (e: {
  id: string;
  walletId: string;
  type: LedgerEntryType;
  amount: import("@prisma/client/runtime/library").Decimal;
  balanceAfter: import("@prisma/client/runtime/library").Decimal;
  referenceType: string | null;
  referenceId: string | null;
  metadata: unknown;
  createdAt: Date;
}): LedgerDTO => ({
  id: e.id,
  walletId: e.walletId,
  type: e.type,
  amount: e.amount.toString(),
  balanceAfter: e.balanceAfter.toString(),
  referenceType: e.referenceType,
  referenceId: e.referenceId,
  metadata: (e.metadata as Record<string, unknown> | null) ?? null,
  createdAt: e.createdAt.toISOString(),
});

export interface GetOrCreateWalletInput {
  userId: string;
  currency: Currency;
}

export const getOrCreateWallet = async (
  input: GetOrCreateWalletInput
): Promise<WalletDTO> => {
  const existing = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: input.userId, currency: input.currency } },
  });
  if (existing) return toDto(existing);
  const created = await prisma.wallet.create({
    data: { userId: input.userId, currency: input.currency },
  });
  return toDto(created);
};

export const listWallets = async (userId: string): Promise<WalletDTO[]> => {
  const wallets = await prisma.wallet.findMany({ where: { userId } });
  return wallets.map(toDto);
};

export interface LedgerParams {
  type: LedgerEntryType;
  amount: string; // signed
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface TransferParams extends LedgerParams {
  userId: string;
  currency: Currency;
}

export const recordEntry = async (params: TransferParams): Promise<LedgerDTO> => {
  const wallet = await getOrCreateWallet({ userId: params.userId, currency: params.currency });
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.wallet.findUnique({ where: { id: wallet.id } });
    if (!current) throw new Error("wallet_not_found");
    const balanceAfter = addDecimal(current.balance.toString(), params.amount);
    if (compareDecimal(balanceAfter, ZERO) < 0) {
      throw new Error("insufficient_funds");
    }
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter, version: { increment: 1 } },
    });
    const entry = await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        type: params.type,
        amount: params.amount,
        balanceAfter: updated.balance.toString(),
        lockedAfter: updated.locked.toString(),
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
        idempotencyKey: params.idempotencyKey,
      },
    });
    return ledgerDto(entry);
  });
};

export interface LockFundsInput {
  userId: string;
  currency: Currency;
  amount: string;
  referenceType: string;
  referenceId: string;
}

export const lockFunds = async (input: LockFundsInput): Promise<void> => {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: input.userId, currency: input.currency } },
    });
    if (!wallet) throw new Error("wallet_not_found");
    if (compareDecimal(wallet.balance.toString(), input.amount) < 0) {
      throw new Error("insufficient_funds");
    }
    const newBalance = subDecimal(wallet.balance.toString(), input.amount);
    const newLocked = addDecimal(wallet.locked.toString(), input.amount);
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance, locked: newLocked, version: { increment: 1 } },
    });
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        type: "bet_debit",
        amount: `-${input.amount}`,
        balanceAfter: newBalance,
        lockedAfter: newLocked,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });
  });
};

export interface SettleFundsInput {
  userId: string;
  currency: Currency;
  betAmount: string;
  payout: string;
  referenceType: string;
  referenceId: string;
}

export const settleFunds = async (input: SettleFundsInput): Promise<{ payout: string }> => {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: input.userId, currency: input.currency } },
    });
    if (!wallet) throw new Error("wallet_not_found");

    const newLocked = subDecimal(wallet.locked.toString(), input.betAmount);
    const newBalance = addDecimal(wallet.balance.toString(), input.payout);
    if (compareDecimal(newLocked, ZERO) < 0) throw new Error("locked_underflow");

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance, locked: newLocked, version: { increment: 1 } },
    });

    if (compareDecimal(input.payout, ZERO) > 0) {
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: "bet_credit",
          amount: input.payout,
          balanceAfter: newBalance,
          lockedAfter: newLocked,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
      });
    } else {
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: "adjustment",
          amount: "0",
          balanceAfter: newBalance,
          lockedAfter: newLocked,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          metadata: { reason: "bet_loss_consumes_locked" },
        },
      });
    }

    return { payout: input.payout };
  });
};

export interface RefundLockInput {
  userId: string;
  currency: Currency;
  betAmount: string;
  referenceType: string;
  referenceId: string;
}

export const refundLock = async (input: RefundLockInput): Promise<void> => {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: input.userId, currency: input.currency } },
    });
    if (!wallet) throw new Error("wallet_not_found");
    const newLocked = subDecimal(wallet.locked.toString(), input.betAmount);
    const newBalance = addDecimal(wallet.balance.toString(), input.betAmount);
    if (compareDecimal(newLocked, ZERO) < 0) throw new Error("locked_underflow");
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance, locked: newLocked, version: { increment: 1 } },
    });
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        type: "refund",
        amount: input.betAmount,
        balanceAfter: newBalance,
        lockedAfter: newLocked,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });
  });
};

export const totalBalanceMinor = async (
  userId: string,
  currency: Currency
): Promise<bigint> => {
  const w = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  if (!w) return 0n;
  return toMinor(w.balance.toString());
};