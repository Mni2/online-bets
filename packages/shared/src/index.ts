/// <reference types="node" />
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

/* ---------- Money helpers ---------- */

export type Decimal = string;

export const ZERO: Decimal = "0";

export const toMinor = (value: Decimal | number, decimals = 8): bigint => {
  const s = typeof value === "number" ? value.toFixed(decimals) : value;
  const split = s.split(".");
  const int = split[0] ?? "0";
  const frac = split[1] ?? "";
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const sign = s.startsWith("-") ? -1n : 1n;
  return sign * (BigInt(int.replace("-", "")) * 10n ** BigInt(decimals) + BigInt(padded || "0"));
};

export const fromMinor = (minor: bigint, decimals = 8): Decimal => {
  const sign = minor < 0n ? "-" : "";
  const abs = minor < 0n ? -minor : minor;
  const base = 10n ** BigInt(decimals);
  const int = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac.length > 0 ? `${sign}${int}.${frac}` : `${sign}${int}`;
};

export const addDecimal = (a: Decimal, b: Decimal): Decimal =>
  fromMinor(toMinor(a) + toMinor(b));

export const subDecimal = (a: Decimal, b: Decimal): Decimal =>
  fromMinor(toMinor(a) - toMinor(b));

export const mulDecimal = (a: Decimal, b: Decimal, decimals = 8): Decimal =>
  fromMinor((toMinor(a) * toMinor(b)) / 10n ** BigInt(decimals));

export const compareDecimal = (a: Decimal, b: Decimal): -1 | 0 | 1 => {
  const diff = toMinor(a) - toMinor(b);
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
};

/* ---------- Ids ---------- */

export const uuid = (): string => {
  const b = randomBytes(16);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export const shortId = (length = 10): string =>
  randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);

/* ---------- Hashing / HMAC ---------- */

export const sha256 = (input: string | Buffer): string =>
  createHash("sha256").update(input).digest("hex");

export const hmacSha256 = (key: string | Buffer, data: string | Buffer): string =>
  createHmac("sha256", key).update(data).digest("hex");

export const constantTimeEquals = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
};

/* ---------- Constants ---------- */

export const BRAND = {
  name: "Nova Royale",
  tagline: "Provably fair. Instant payouts. VIP treatment.",
  domain: "novaroyale.example",
} as const;

export const HOUSE_EDGE_BPS_DEFAULT = 150; // 1.50%
export const BCRYPT_ROUNDS_DEFAULT = 12;
export const MAX_BET_DEFAULT = "10000";
export const MIN_BET_DEFAULT = "0.10";
export const DICE_MAX_MULTIPLIER = 9900; // 99x

export const ROLE_PERMISSIONS = {
  player: ["wallet:read", "game:play", "chat:write"],
  vip: ["wallet:read", "game:play", "chat:write", "bonus:claim"],
  moderator: ["wallet:read", "game:play", "chat:write", "chat:moderate", "user:read"],
  admin: [
    "wallet:read",
    "game:play",
    "chat:write",
    "chat:moderate",
    "user:read",
    "user:write",
    "wallet:write",
    "game:write",
    "bonus:write",
    "analytics:read",
  ],
  superadmin: ["*"],
} as const;

/* ---------- Logging ---------- */

export type LogLevel = "debug" | "info" | "warn" | "error";

export const formatLog = (
  level: LogLevel,
  scope: string,
  message: string,
  data?: Record<string, unknown>
): string =>
  JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...(data ?? {}),
  });