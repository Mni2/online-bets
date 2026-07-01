import { hmacSha256, mulDecimal } from "@nova/shared";

// ─── Types ───────────────────────────────────────────────────────────────────
export type SlotSymbol = "🍒" | "🍋" | "🍊" | "🍇" | "🔔" | "⭐" | "💎" | "7️⃣" | "🃏";

export interface SlotPayline {
  index: number;
  symbols: SlotSymbol[];
  positions: [number, number, number]; // row indices for each reel
}

export interface SlotSpinResult {
  reels: SlotSymbol[][];       // 5 reels × 3 visible rows
  paylines: SlotPaylineResult[];
  totalMultiplier: number;
  totalPayout: string;
}

export interface SlotPaylineResult {
  paylineIndex: number;
  matchCount: number;
  symbol: SlotSymbol;
  multiplier: number;
  payout: string;
}

// ─── Symbol weights (determines frequency on each reel) ─────────────────────
// Lower weight = rarer = higher payout. Tuned for ~80% RTP.
const REEL_STRIPS: SlotSymbol[][] = [
  // Reel 1
  ["🍒","🍒","🍒","🍋","🍋","🍋","🍊","🍊","🍊","🍇","🍇","🔔","🔔","⭐","💎","7️⃣","🃏","🍒","🍋","🍊"],
  // Reel 2
  ["🍒","🍒","🍋","🍋","🍋","🍊","🍊","🍊","🍇","🍇","🍇","🔔","🔔","⭐","⭐","💎","7️⃣","🃏","🍒","🍊"],
  // Reel 3
  ["🍒","🍒","🍒","🍋","🍋","🍊","🍊","🍇","🍇","🍇","🔔","🔔","🔔","⭐","💎","7️⃣","🃏","🍋","🍊","🍒"],
  // Reel 4
  ["🍒","🍒","🍋","🍋","🍋","🍊","🍊","🍊","🍇","🍇","🔔","🔔","⭐","⭐","💎","💎","7️⃣","🃏","🍊","🍇"],
  // Reel 5
  ["🍒","🍒","🍒","🍋","🍋","🍋","🍊","🍊","🍇","🍇","🍇","🔔","⭐","💎","7️⃣","🃏","🍒","🍋","🍊","🔔"],
];

// ─── Paytable (matches × symbol → multiplier) ──────────────────────────────
// Adjusted for 80% RTP / 20% house edge
const PAYTABLE: Record<SlotSymbol, Record<number, number>> = {
  "🍒": { 3: 1.6, 4: 4.0, 5: 8.0 },
  "🍋": { 3: 2.0, 4: 5.6, 5: 12.0 },
  "🍊": { 3: 2.4, 4: 8.0, 5: 16.0 },
  "🍇": { 3: 3.2, 4: 10.4, 5: 24.0 },
  "🔔": { 3: 4.0, 4: 16.0, 5: 40.0 },
  "⭐": { 3: 8.0, 4: 24.0, 5: 80.0 },
  "💎": { 3: 12.0, 4: 40.0, 5: 160.0 },
  "7️⃣": { 3: 20.0, 4: 80.0, 5: 400.0 },
  "🃏": { 3: 0, 4: 0, 5: 0 },  // Wild - matches anything but has no standalone payout
};

// ─── Payline definitions (20 paylines across 5 reels × 3 rows) ──────────────
// Each array = [row on reel1, row on reel2, row on reel3, row on reel4, row on reel5]
const PAYLINE_PATTERNS: number[][] = [
  [1,1,1,1,1], // Middle straight
  [0,0,0,0,0], // Top straight
  [2,2,2,2,2], // Bottom straight
  [0,1,2,1,0], // V shape
  [2,1,0,1,2], // Inverted V
  [0,0,1,0,0], // Slight bump top
  [2,2,1,2,2], // Slight bump bottom
  [1,0,0,0,1], // U shape top
  [1,2,2,2,1], // U shape bottom
  [0,1,1,1,0], // Flat top bump
  [2,1,1,1,2], // Flat bottom bump
  [0,1,0,1,0], // Zigzag top
  [2,1,2,1,2], // Zigzag bottom
  [1,0,1,0,1], // Alternating top
  [1,2,1,2,1], // Alternating bottom
  [0,0,1,2,2], // Diagonal down
  [2,2,1,0,0], // Diagonal up
  [0,1,2,2,1], // Slide down
  [2,1,0,0,1], // Slide up
  [1,1,0,1,1], // Notch top
];

// ─── Engine Functions ────────────────────────────────────────────────────────

/** Derive reel stop positions from provably fair seeds */
export function deriveSlotReels(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): SlotSymbol[][] {
  const visibleRows = 3;
  const reels: SlotSymbol[][] = [];

  for (let r = 0; r < 5; r++) {
    const hash = hmacSha256(serverSeed, `${clientSeed}:${nonce}:reel${r}`);
    const stopPos = parseInt(hash.slice(0, 8), 16) % REEL_STRIPS[r]!.length;
    const strip = REEL_STRIPS[r]!;
    const visible: SlotSymbol[] = [];

    for (let row = 0; row < visibleRows; row++) {
      const idx = (stopPos + row) % strip.length;
      visible.push(strip[idx]!);
    }

    reels.push(visible);
  }

  return reels;
}

/** Evaluate paylines and calculate winnings */
export function evaluateSlotSpin(
  reels: SlotSymbol[][],
  betPerLine: string,
  activePaylines: number = 20
): SlotSpinResult {
  const paylines: SlotPaylineResult[] = [];
  let totalMultiplier = 0;

  for (let p = 0; p < Math.min(activePaylines, PAYLINE_PATTERNS.length); p++) {
    const pattern = PAYLINE_PATTERNS[p]!;
    const lineSymbols: SlotSymbol[] = pattern.map((row, reelIdx) => reels[reelIdx]![row]!);

    // Find longest match from left to right
    const firstSymbol = lineSymbols[0]!;
    let matchSymbol = firstSymbol === "🃏" ? lineSymbols.find(s => s !== "🃏") ?? "🃏" : firstSymbol;
    let matchCount = 0;

    for (const sym of lineSymbols) {
      if (sym === matchSymbol || sym === "🃏") {
        matchCount++;
      } else {
        break;
      }
    }

    if (matchCount >= 3 && matchSymbol !== "🃏") {
      const multiplier = PAYTABLE[matchSymbol]?.[matchCount] ?? 0;
      if (multiplier > 0) {
        const payout = mulDecimal(betPerLine, multiplier.toString());
        totalMultiplier += multiplier;
        paylines.push({
          paylineIndex: p,
          matchCount,
          symbol: matchSymbol,
          multiplier,
          payout,
        });
      }
    }
  }

  const totalPayout = paylines.reduce(
    (sum, pl) => {
      const current = parseFloat(sum);
      const add = parseFloat(pl.payout);
      return (current + add).toFixed(8);
    },
    "0"
  );

  return { reels, paylines, totalMultiplier, totalPayout };
}
