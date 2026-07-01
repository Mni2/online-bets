import { createHmac, randomBytes } from "node:crypto";
import { hmacSha256, mulDecimal, addDecimal, ZERO } from "@nova/shared";

// ─── Types ───────────────────────────────────────────────────────────────────
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface BJCard {
  rank: Rank;
  suit: Suit;
  value: number; // Primary value (A=11, face=10)
}

export interface BJHand {
  cards: BJCard[];
  total: number;
  soft: boolean;   // Contains an Ace counted as 11
  busted: boolean;
  blackjack: boolean;
  stood: boolean;
  doubled: boolean;
  surrendered: boolean;
}

export type BJAction = "hit" | "stand" | "double" | "split" | "surrender";

export type BJGameStatus = "betting" | "playing" | "dealer_turn" | "settled";

export interface BJGameState {
  status: BJGameStatus;
  playerHands: BJHand[];
  activeHandIndex: number;
  dealerHand: BJHand;
  dealerHidden: boolean; // true while player is still acting
  shoe: BJCard[];
  betAmount: string;
  currency: string;
  results: BJHandResult[];
}

export interface BJHandResult {
  handIndex: number;
  outcome: "blackjack" | "win" | "push" | "lose" | "surrender";
  payout: string;
  multiplier: number;
}

// ─── 80% RTP Payout Multipliers ─────────────────────────────────────────────
// Standard blackjack RTP is ~99.5%. We scale payouts to achieve 80% RTP.
export const BJ_PAYOUTS = {
  blackjack: 1.20,    // Standard: 1.50 (3:2)
  win: 0.80,          // Standard: 1.00
  push: 0,            // Standard: 0 (bet returned)
  lose: -1,           // Full loss
  surrender: -0.50,   // Standard: -0.50 (half bet back)
  insurance: 1.60,    // Standard: 2.00
};

// ─── Card Utilities ──────────────────────────────────────────────────────────
const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank);
}

function createCard(rank: Rank, suit: Suit): BJCard {
  return { rank, suit, value: cardValue(rank) };
}

/** Create a 6-deck shoe */
export function createShoe(): BJCard[] {
  const shoe: BJCard[] = [];
  for (let d = 0; d < 6; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push(createCard(rank, suit));
      }
    }
  }
  return shoe;
}

/** Fisher-Yates shuffle seeded by HMAC for provably fair */
export function shuffleShoe(shoe: BJCard[], serverSeed: string, clientSeed: string, nonce: number): BJCard[] {
  const shuffled = [...shoe];
  const hash = hmacSha256(serverSeed, `${clientSeed}:${nonce}`);

  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use different bytes of the hash for each swap
    const hashSegment = hmacSha256(serverSeed, `${clientSeed}:${nonce}:${i}`);
    const j = parseInt(hashSegment.slice(0, 8), 16) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled;
}

/** Calculate hand total with soft/hard logic */
export function evaluateHand(cards: BJCard[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += card.value;
    if (card.rank === "A") aces++;
  }

  // Convert aces from 11 to 1 as needed
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return { total, soft: aces > 0 };
}

/** Create a BJHand from cards */
export function makeHand(cards: BJCard[], doubled = false, surrendered = false): BJHand {
  const { total, soft } = evaluateHand(cards);
  return {
    cards,
    total,
    soft,
    busted: total > 21,
    blackjack: cards.length === 2 && total === 21,
    stood: false,
    doubled,
    surrendered,
  };
}

/** Deal initial cards: player gets 2, dealer gets 2 */
export function dealInitial(shoe: BJCard[]): {
  playerCards: BJCard[];
  dealerCards: BJCard[];
  remainingShoe: BJCard[];
} {
  const s = [...shoe];
  const playerCards = [s.pop()!, s.pop()!];
  const dealerCards = [s.pop()!, s.pop()!];
  return { playerCards, dealerCards, remainingShoe: s };
}

/** Draw a card from the shoe */
export function drawCard(shoe: BJCard[]): { card: BJCard; remainingShoe: BJCard[] } {
  const s = [...shoe];
  const card = s.pop()!;
  return { card, remainingShoe: s };
}

/** Play dealer hand: dealer hits on soft 17, stands on hard 17+ */
export function playDealer(dealerHand: BJHand, shoe: BJCard[]): { hand: BJHand; remainingShoe: BJCard[] } {
  let cards = [...dealerHand.cards];
  let s = [...shoe];
  let { total, soft } = evaluateHand(cards);

  while (total < 17 || (total === 17 && soft)) {
    const card = s.pop()!;
    cards.push(card);
    const result = evaluateHand(cards);
    total = result.total;
    soft = result.soft;
  }

  return {
    hand: makeHand(cards),
    remainingShoe: s,
  };
}

/** Determine available actions for the current hand */
export function getAvailableActions(hand: BJHand, handCount: number): BJAction[] {
  if (hand.stood || hand.busted || hand.blackjack || hand.surrendered) return [];

  const actions: BJAction[] = ["hit", "stand"];

  // Can double only on first two cards, not after split
  if (hand.cards.length === 2 && !hand.doubled) {
    actions.push("double");
  }

  // Can split if first two cards have same rank
  if (hand.cards.length === 2 && hand.cards[0]!.rank === hand.cards[1]!.rank && handCount < 4) {
    actions.push("split");
  }

  // Can surrender only on initial hand (2 cards, no split)
  if (hand.cards.length === 2 && handCount === 1) {
    actions.push("surrender");
  }

  return actions;
}

/** Settle a single hand against the dealer */
export function settleHand(
  playerHand: BJHand,
  dealerHand: BJHand,
  betAmount: string,
  handIndex: number
): BJHandResult {
  // Surrendered
  if (playerHand.surrendered) {
    const payout = mulDecimal(betAmount, "0.50"); // Return half
    return { handIndex, outcome: "surrender", payout, multiplier: BJ_PAYOUTS.surrender };
  }

  // Player busted
  if (playerHand.busted) {
    return { handIndex, outcome: "lose", payout: "0", multiplier: BJ_PAYOUTS.lose };
  }

  // Player blackjack (and dealer doesn't have one)
  if (playerHand.blackjack && !dealerHand.blackjack) {
    const payout = mulDecimal(betAmount, (1 + BJ_PAYOUTS.blackjack).toString());
    return { handIndex, outcome: "blackjack", payout, multiplier: BJ_PAYOUTS.blackjack };
  }

  // Both blackjack = push
  if (playerHand.blackjack && dealerHand.blackjack) {
    return { handIndex, outcome: "push", payout: betAmount, multiplier: 0 };
  }

  // Dealer busted
  if (dealerHand.busted) {
    const payout = mulDecimal(betAmount, (1 + BJ_PAYOUTS.win).toString());
    return { handIndex, outcome: "win", payout, multiplier: BJ_PAYOUTS.win };
  }

  // Compare totals
  if (playerHand.total > dealerHand.total) {
    const payout = mulDecimal(betAmount, (1 + BJ_PAYOUTS.win).toString());
    return { handIndex, outcome: "win", payout, multiplier: BJ_PAYOUTS.win };
  }

  if (playerHand.total === dealerHand.total) {
    return { handIndex, outcome: "push", payout: betAmount, multiplier: 0 };
  }

  // Dealer wins
  return { handIndex, outcome: "lose", payout: "0", multiplier: BJ_PAYOUTS.lose };
}
