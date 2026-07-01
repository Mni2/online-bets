import { hmacSha256, mulDecimal, compareDecimal, ZERO } from "@nova/shared";

export type RouletteBetType =
  | "straight"
  | "split"
  | "street"
  | "corner"
  | "line"
  | "dozen"
  | "column"
  | "color"
  | "parity"
  | "highlow";

export interface RouletteSingleBet {
  type: RouletteBetType;
  numbers: number[]; // list of numbers covered by this chip placement
  amount: string;
}

export interface RouletteEvaluateResult {
  won: boolean;
  multiplier: number;
  payout: string;
}

// 80% RTP / 20% House Edge multiplier values
export const ROULETTE_MULTIPLIERS: Record<RouletteBetType, number> = {
  straight: 29.60,
  split: 14.80,
  street: 9.86,
  corner: 7.40,
  line: 4.93,
  dozen: 2.46,
  column: 2.46,
  color: 1.64,
  parity: 1.64,
  highlow: 1.64,
};

/**
 * Derives the winning roulette number (0-36) deterministically from seeds using HMAC-SHA256.
 */
export function deriveRouletteNumber(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): number {
  const hash = hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
  const num = parseInt(hash.slice(0, 8), 16);
  return num % 37; // 0 to 36
}

/**
 * Evaluates a single roulette bet placement against the winning number.
 */
export function evaluateRouletteBet(
  bet: RouletteSingleBet,
  winningNumber: number
): RouletteEvaluateResult {
  const won = bet.numbers.includes(winningNumber);
  if (!won) {
    return { won: false, multiplier: 0, payout: "0" };
  }

  const multiplier = ROULETTE_MULTIPLIERS[bet.type] ?? 0;
  const payout = mulDecimal(bet.amount, multiplier.toString());

  return {
    won: true,
    multiplier,
    payout,
  };
}
