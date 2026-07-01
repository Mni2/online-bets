import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface SportFixture {
  id: string;
  slug: string;
  sport: "soccer" | "basketball" | "tennis" | "esports";
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: "live" | "upcoming" | "finished";
  homeOdds: number;
  drawOdds?: number;
  awayOdds: number;
  homeScore?: number;
  awayScore?: number;
  minute?: string;
}

// 80% RTP Odds Calibration:
// Standard 50/50 event fair odds = 2.00. With 20% House Edge (80% RTP), payout multiplier is 2.00 * 0.80 = 1.60.
// For 3-way soccer (33.3% fair chance, fair odds 3.00), 80% RTP odds = 3.00 * 0.80 = 2.40.
export const FIXTURES: SportFixture[] = [
  {
    id: "match-1",
    slug: "real-madrid-vs-mancity",
    sport: "soccer",
    league: "UEFA Champions League",
    homeTeam: "Real Madrid CF",
    awayTeam: "Manchester City",
    startTime: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    status: "live",
    homeOdds: 2.40,
    drawOdds: 2.40,
    awayOdds: 2.40,
    homeScore: 1,
    awayScore: 1,
    minute: "68'",
  },
  {
    id: "match-2",
    slug: "lakers-vs-celtics",
    sport: "basketball",
    league: "NBA Finals Game 7",
    homeTeam: "Los Angeles Lakers",
    awayTeam: "Boston Celtics",
    startTime: new Date(Date.now() + 1000 * 60 * 120).toISOString(),
    status: "live",
    homeOdds: 1.60,
    awayOdds: 1.60,
    homeScore: 98,
    awayScore: 96,
    minute: "Q4 04:12",
  },
  {
    id: "match-3",
    slug: "alcaraz-vs-sinner",
    sport: "tennis",
    league: "Wimbledon Men's Final",
    homeTeam: "Carlos Alcaraz",
    awayTeam: "Jannik Sinner",
    startTime: new Date(Date.now() + 1000 * 60 * 240).toISOString(),
    status: "upcoming",
    homeOdds: 1.60,
    awayOdds: 1.60,
  },
  {
    id: "match-4",
    slug: "navi-vs-faze",
    sport: "esports",
    league: "CS2 Cologne Grand Final",
    homeTeam: "Natus Vincere",
    awayTeam: "FaZe Clan",
    startTime: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    status: "live",
    homeOdds: 1.60,
    awayOdds: 1.60,
    homeScore: 14,
    awayScore: 13,
    minute: "Map 3 - Mirage",
  },
];

export interface SportsBetInput {
  userId: string;
  fixtureSlug: string;
  selection: "home" | "draw" | "away";
  amount: string;
  currency: string;
}

export interface SportsBetResult {
  betId: string;
  fixtureSlug: string;
  selection: string;
  odds: number;
  amount: string;
  payout: string;
  profit: string;
  status: "won" | "lost";
  matchScore: string;
  commentary: string;
}

/**
 * Simulates instant virtual sports settlement for immediate VIP feedback.
 * Calibrated strictly to an 80.0% RTP / 20.0% House Edge.
 */
export const simulateInstantSportsBet = async (
  prisma: PrismaClient,
  lockFundsFn: any,
  settleFundsFn: any,
  input: SportsBetInput
): Promise<SportsBetResult> => {
  const fixture = FIXTURES.find((f) => f.slug === input.fixtureSlug) ?? FIXTURES[0]!;
  
  const betAmount = parseFloat(input.amount);
  if (isNaN(betAmount) || betAmount <= 0) throw new Error("invalid_amount");

  const roundId = randomBytes(16).toString("hex");

  // Step 1: Lock funds via Wallet Service
  await lockFundsFn({
    userId: input.userId,
    amount: input.amount,
    currency: (input.currency ?? "USD") as any,
    referenceType: "sports_bet",
    referenceId: roundId,
  });

  // Step 2: Determine odds and 80% RTP win probability
  let odds = fixture.homeOdds;
  let winChance = 0.50; // default for 1.60 odds -> 0.50 * 1.60 = 0.80 RTP

  if (fixture.sport === "soccer") {
    odds = fixture.drawOdds ?? 2.40;
    winChance = 0.3333; // 0.3333 * 2.40 = 0.80 RTP
  }

  const roll = Math.random();
  const won = roll < winChance;

  const multiplier = won ? odds : 0;
  const payoutNum = won ? Number((betAmount * multiplier).toFixed(2)) : 0;
  const profitNum = Number((payoutNum - betAmount).toFixed(2));

  let matchScore = "";
  let commentary = "";

  if (fixture.sport === "soccer") {
    if (won) {
      if (input.selection === "home") {
        matchScore = "2 - 1 (FT)";
        commentary = `GOAL 89'! ${fixture.homeTeam} scores a dramatic stoppage time winner! Your bet hits!`;
      } else if (input.selection === "away") {
        matchScore = "1 - 2 (FT)";
        commentary = `GOAL 90+2'! ${fixture.awayTeam} seals a stunning away comeback! Huge win!`;
      } else {
        matchScore = "2 - 2 (FT)";
        commentary = `FULL TIME! A thrilling draw at the Santiago Bernabéu! Draw bet cashes!`;
      }
    } else {
      matchScore = input.selection === "home" ? "1 - 2 (FT)" : "2 - 1 (FT)";
      commentary = `FULL TIME! Hard fought match, but the final score didn't favor your selection.`;
    }
  } else if (fixture.sport === "basketball") {
    if (won) {
      matchScore = "112 - 108 (Final)";
      commentary = `BUZZER BEATER! A clutch 3-pointer seals the victory for your selection!`;
    } else {
      matchScore = "104 - 110 (Final)";
      commentary = `FINAL BUZZER! Tough defensive stretch in Q4 cost the lead.`;
    }
  } else if (fixture.sport === "esports") {
    if (won) {
      matchScore = "16 - 13 (Map 3 Won)";
      commentary = `CLUTCH 1v3 ACE! Your team defuses the bomb and wins the championship!`;
    } else {
      matchScore = "14 - 16 (Map 3 Lost)";
      commentary = `MATCH POINT LOST! An eco-round surprise flips the final round.`;
    }
  } else {
    if (won) {
      matchScore = "6-4, 7-6 (Straight Sets)";
      commentary = `CHAMPIONSHIP POINT CONVERTED! An ace down the T finishes the match!`;
    } else {
      matchScore = "4-6, 6-7 (Lost in Tiebreak)";
      commentary = `MATCH OVER. A unforced error into the net ends the comeback attempt.`;
    }
  }

  // Step 3: Settle funds in database
  await settleFundsFn({
    userId: input.userId,
    betAmount: input.amount,
    payout: payoutNum.toString(),
    currency: (input.currency ?? "USD") as any,
    referenceType: "sports_settle",
    referenceId: roundId,
  });

  return {
    betId: roundId,
    fixtureSlug: fixture.slug,
    selection: input.selection,
    odds,
    amount: input.amount,
    payout: payoutNum.toString(),
    profit: profitNum.toString(),
    status: won ? "won" : "lost",
    matchScore,
    commentary,
  };
};
