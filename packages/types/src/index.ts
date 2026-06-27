import { z } from "zod";

/* ---------- Primitives ---------- */

export const CurrencySchema = z.enum(["USD", "EUR", "GBP", "BTC", "ETH", "USDT"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const DecimalString = z
  .string()
  .regex(/^\d+(\.\d{1,8})?$/, "Invalid decimal string");
export type DecimalString = z.infer<typeof DecimalString>;

export const IsoTimestamp = z.string().datetime();
export type IsoTimestamp = z.infer<typeof IsoTimestamp>;

/* ---------- User / Auth ---------- */

export const RoleSchema = z.enum(["player", "vip", "moderator", "admin", "superadmin"]);
export type Role = z.infer<typeof RoleSchema>;

export const KycStatusSchema = z.enum(["none", "pending", "approved", "rejected"]);
export type KycStatus = z.infer<typeof KycStatusSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(24),
  displayName: z.string().min(1).max(40),
  role: RoleSchema,
  kycStatus: KycStatusSchema,
  selfExcludedUntil: IsoTimestamp.nullable(),
  createdAt: IsoTimestamp,
});
export type User = z.infer<typeof UserSchema>;

export const RegisterPayloadSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(40),
  acceptTos: z.boolean().refine((v) => v === true, { message: 'acceptTos required' }),
  acceptAge: z.boolean().refine((v) => v === true, { message: 'acceptAge required' }),
  referralCode: z.string().optional(),
});
export type RegisterPayload = z.infer<typeof RegisterPayloadSchema>;

export const LoginPayloadSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8).max(128),
});
export type LoginPayload = z.infer<typeof LoginPayloadSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

/* ---------- Wallet / Ledger ---------- */

export const LedgerEntryTypeSchema = z.enum([
  "deposit",
  "withdrawal",
  "bet_debit",
  "bet_credit",
  "bonus_credit",
  "bonus_debit",
  "rakeback",
  "refund",
  "adjustment",
  "transfer_in",
  "transfer_out",
]);
export type LedgerEntryType = z.infer<typeof LedgerEntryTypeSchema>;

export const WalletSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  currency: CurrencySchema,
  balance: DecimalString,
  locked: DecimalString,
  bonusBalance: DecimalString,
  updatedAt: IsoTimestamp,
});
export type Wallet = z.infer<typeof WalletSchema>;

export const WalletLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  walletId: z.string().uuid(),
  type: LedgerEntryTypeSchema,
  amount: DecimalString,
  balanceAfter: DecimalString,
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: IsoTimestamp,
});
export type WalletLedgerEntry = z.infer<typeof WalletLedgerEntrySchema>;

export const DepositRequestSchema = z.object({
  currency: CurrencySchema,
  amount: DecimalString,
  method: z.enum(["stripe", "coinbase", "manual"]),
  reference: z.string().optional(),
});
export type DepositRequest = z.infer<typeof DepositRequestSchema>;

export const WithdrawalRequestSchema = z.object({
  currency: CurrencySchema,
  amount: DecimalString,
  destination: z.string().min(4),
});
export type WithdrawalRequest = z.infer<typeof WithdrawalRequestSchema>;

/* ---------- Games ---------- */

export const GameCategorySchema = z.enum([
  "dice",
  "crash",
  "slots",
  "roulette",
  "blackjack",
  "live",
  "sports",
]);
export type GameCategory = z.infer<typeof GameCategorySchema>;

export const GameSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: GameCategorySchema,
  rtp: z.number().min(0).max(100),
  houseEdge: z.number().min(0).max(100),
  isLive: z.boolean(),
  thumbnail: z.string(),
});
export type Game = z.infer<typeof GameSchema>;

export const ProvablyFairSeedPairSchema = z.object({
  serverSeedHash: z.string(),
  clientSeed: z.string(),
  nonce: z.number().int().nonnegative(),
});
export type ProvablyFairSeedPair = z.infer<typeof ProvablyFairSeedPairSchema>;

export const DiceBetSchema = z.object({
  amount: DecimalString,
  currency: CurrencySchema,
  target: z.number().min(2).max(98),
  direction: z.enum(["under", "over"]),
  clientSeed: z.string().min(1).max(64),
  nonce: z.number().int().nonnegative(),
});
export type DiceBet = z.infer<typeof DiceBetSchema>;

export const DiceResultSchema = z.object({
  betId: z.string().uuid(),
  roll: z.number().min(0).max(100),
  target: z.number(),
  direction: z.enum(["under", "over"]),
  amount: DecimalString,
  payout: DecimalString,
  multiplier: z.number(),
  profit: DecimalString,
  serverSeed: z.string(),
  serverSeedHash: z.string(),
  clientSeed: z.string(),
  nonce: z.number().int(),
  createdAt: IsoTimestamp,
});
export type DiceResult = z.infer<typeof DiceResultSchema>;

/* ---------- API envelope ---------- */

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
