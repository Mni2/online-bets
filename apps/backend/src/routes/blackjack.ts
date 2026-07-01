import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import {
  createShoe, shuffleShoe, dealInitial, drawCard, makeHand, playDealer,
  getAvailableActions, settleHand, evaluateHand,
  type BJGameState, type BJHandResult, type BJCard, type BJHand,
} from "@nova/games";
import { lockFunds, settleFunds } from "@nova/wallet";
import { randomBytes, createHmac } from "node:crypto";
import { addDecimal, ZERO } from "@nova/shared";

// ─── In-memory game sessions (per user) ──────────────────────────────────────
const activeSessions = new Map<string, BJGameState & { serverSeed: string; clientSeed: string; nonce: number; roundId: string }>();

const dealBody = {
  type: "object" as const,
  required: ["amount", "currency"],
  properties: {
    amount: { type: "string" as const, pattern: "^\\d+(\\.\\d{1,8})?$" },
    currency: { type: "string" as const, enum: ["USD", "EUR", "GBP", "BTC", "ETH", "USDT"] },
    clientSeed: { type: "string" as const },
  },
  additionalProperties: false,
};

const actionBody = {
  type: "object" as const,
  required: ["action"],
  properties: {
    action: { type: "string" as const, enum: ["hit", "stand", "double", "split", "surrender"] },
  },
  additionalProperties: false,
};

export const blackjackRoutes = async (app: FastifyInstance): Promise<void> => {

  // ─── GET /state — current game state ───────────────────────────────────────
  app.get("/state", async (req) => {
    const auth = requireAuth(req);
    const session = activeSessions.get(auth.sub);
    if (!session) {
      return { status: "no_game", message: "No active blackjack game. POST /deal to start." };
    }
    return formatStateForClient(session);
  });

  // ─── POST /deal — start a new hand ─────────────────────────────────────────
  app.post(
    "/deal",
    { schema: { body: dealBody } },
    async (req, reply) => {
      const auth = requireAuth(req);
      const body = req.body as { amount: string; currency: string; clientSeed?: string };

      // Don't allow new deal if game is in progress
      const existing = activeSessions.get(auth.sub);
      if (existing && existing.status === "playing") {
        return reply.code(400).send({ error: { code: "game_in_progress", message: "Finish your current hand first" } });
      }

      const amt = parseFloat(body.amount);
      if (isNaN(amt) || amt < 0.10 || amt > 10000) {
        return reply.code(400).send({ error: { code: "invalid_amount", message: "Bet must be between $0.10 and $10,000" } });
      }

      // Generate seeds
      const serverSeed = randomBytes(32).toString("hex");
      const clientSeed = body.clientSeed || `nova-bj-${randomBytes(4).toString("hex")}`;
      const nonce = Date.now();
      const roundId = randomBytes(16).toString("hex");

      // Lock funds
      try {
        await lockFunds({
          userId: auth.sub,
          currency: body.currency as any,
          amount: body.amount,
          referenceType: "blackjack_bet",
          referenceId: roundId,
        });
      } catch (err) {
        return reply.code(400).send({
          error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
        });
      }

      // Create & shuffle shoe
      const shoe = shuffleShoe(createShoe(), serverSeed, clientSeed, nonce);
      const { playerCards, dealerCards, remainingShoe } = dealInitial(shoe);

      const playerHand = makeHand(playerCards);
      const dealerHand = makeHand(dealerCards);

      const session: BJGameState & { serverSeed: string; clientSeed: string; nonce: number; roundId: string } = {
        status: "playing",
        playerHands: [playerHand],
        activeHandIndex: 0,
        dealerHand,
        dealerHidden: true,
        shoe: remainingShoe,
        betAmount: body.amount,
        currency: body.currency,
        results: [],
        serverSeed,
        clientSeed,
        nonce,
        roundId,
      };

      // Check for immediate blackjack
      if (playerHand.blackjack) {
        return await settleGame(session, auth.sub);
      }

      activeSessions.set(auth.sub, session);
      return formatStateForClient(session);
    }
  );

  // ─── POST /action — hit, stand, double, split, surrender ───────────────────
  app.post(
    "/action",
    { schema: { body: actionBody } },
    async (req, reply) => {
      const auth = requireAuth(req);
      const session = activeSessions.get(auth.sub);

      if (!session || session.status !== "playing") {
        return reply.code(400).send({ error: { code: "no_active_game", message: "No active game. Deal first." } });
      }

      const { action } = req.body as { action: string };
      const hand = session.playerHands[session.activeHandIndex]!;
      const available = getAvailableActions(hand, session.playerHands.length);

      if (!available.includes(action as any)) {
        return reply.code(400).send({ error: { code: "invalid_action", message: `Action '${action}' not available. Available: ${available.join(", ")}` } });
      }

      switch (action) {
        case "hit": {
          const { card, remainingShoe } = drawCard(session.shoe);
          hand.cards.push(card);
          session.shoe = remainingShoe;
          const eval_ = evaluateHand(hand.cards);
          hand.total = eval_.total;
          hand.soft = eval_.soft;
          hand.busted = eval_.total > 21;
          if (hand.busted) {
            return await advanceOrSettle(session, auth.sub);
          }
          break;
        }

        case "stand": {
          hand.stood = true;
          return await advanceOrSettle(session, auth.sub);
        }

        case "double": {
          // Lock additional funds for the double
          try {
            await lockFunds({
              userId: auth.sub,
              currency: session.currency as any,
              amount: session.betAmount,
              referenceType: "blackjack_double",
              referenceId: session.roundId,
            });
          } catch (err) {
            return reply.code(400).send({
              error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
            });
          }

          hand.doubled = true;
          const { card, remainingShoe } = drawCard(session.shoe);
          hand.cards.push(card);
          session.shoe = remainingShoe;
          const eval_ = evaluateHand(hand.cards);
          hand.total = eval_.total;
          hand.soft = eval_.soft;
          hand.busted = eval_.total > 21;
          hand.stood = true; // Double = one card then stand
          return await advanceOrSettle(session, auth.sub);
        }

        case "split": {
          // Lock additional funds for the split hand
          try {
            await lockFunds({
              userId: auth.sub,
              currency: session.currency as any,
              amount: session.betAmount,
              referenceType: "blackjack_split",
              referenceId: session.roundId,
            });
          } catch (err) {
            return reply.code(400).send({
              error: { code: (err as Error).message, message: (err as Error).message.replace(/_/g, " ") },
            });
          }

          const card1 = hand.cards[0]!;
          const card2 = hand.cards[1]!;

          // Draw one card for each new hand
          const draw1 = drawCard(session.shoe);
          const draw2 = drawCard(draw1.remainingShoe);
          session.shoe = draw2.remainingShoe;

          const newHand1 = makeHand([card1, draw1.card]);
          const newHand2 = makeHand([card2, draw2.card]);

          session.playerHands.splice(session.activeHandIndex, 1, newHand1, newHand2);
          break;
        }

        case "surrender": {
          hand.surrendered = true;
          hand.stood = true;
          return await advanceOrSettle(session, auth.sub);
        }
      }

      activeSessions.set(auth.sub, session);
      return formatStateForClient(session);
    }
  );

  // ─── Helper: advance to next hand or settle the game ───────────────────────
  async function advanceOrSettle(session: BJGameState & { serverSeed: string; clientSeed: string; nonce: number; roundId: string }, userId: string) {
    // Check if there are more hands to play
    const nextIdx = session.activeHandIndex + 1;
    if (nextIdx < session.playerHands.length) {
      session.activeHandIndex = nextIdx;
      activeSessions.set(userId, session);
      return formatStateForClient(session);
    }

    // All hands done → settle
    return await settleGame(session, userId);
  }

  // ─── Helper: settle the game ───────────────────────────────────────────────
  async function settleGame(session: BJGameState & { serverSeed: string; clientSeed: string; nonce: number; roundId: string }, userId: string) {
    session.status = "settled";
    session.dealerHidden = false;

    // Play dealer hand (only if at least one non-busted, non-surrendered player hand)
    const hasLiveHand = session.playerHands.some(h => !h.busted && !h.surrendered);
    if (hasLiveHand) {
      const { hand: finalDealer, remainingShoe } = playDealer(session.dealerHand, session.shoe);
      session.dealerHand = finalDealer;
      session.shoe = remainingShoe;
    }

    // Settle each hand
    let totalPayout = "0";
    let totalBetAmount = "0";
    session.results = [];

    for (let i = 0; i < session.playerHands.length; i++) {
      const hand = session.playerHands[i]!;
      const handBet = hand.doubled ? addDecimal(session.betAmount, session.betAmount) : session.betAmount;
      totalBetAmount = addDecimal(totalBetAmount, handBet);

      const result = settleHand(hand, session.dealerHand, handBet, i);
      session.results.push(result);
      totalPayout = addDecimal(totalPayout, result.payout);
    }

    // Settle with wallet
    try {
      await settleFunds({
        userId,
        currency: session.currency as any,
        betAmount: totalBetAmount,
        payout: totalPayout,
        referenceType: "blackjack_settle",
        referenceId: session.roundId,
      });
    } catch {
      // Settlement failed but game is over
    }

    const response = {
      ...formatStateForClient(session),
      serverSeed: session.serverSeed,
      clientSeed: session.clientSeed,
      nonce: session.nonce,
      roundId: session.roundId,
      totalBetAmount,
      totalPayout,
    };

    // Clean up session
    activeSessions.delete(userId);

    return response;
  }
};

// ─── Format state for client (hide dealer hole card if needed) ───────────────
function formatStateForClient(session: BJGameState & { serverSeed: string; roundId: string }) {
  const serverSeedHash = createHmac("sha256", session.serverSeed).update("blackjack").digest("hex");

  return {
    status: session.status,
    playerHands: session.playerHands.map((h, i) => ({
      cards: h.cards.map(c => ({ rank: c.rank, suit: c.suit })),
      total: h.total,
      soft: h.soft,
      busted: h.busted,
      blackjack: h.blackjack,
      stood: h.stood,
      doubled: h.doubled,
      surrendered: h.surrendered,
      isActive: i === session.activeHandIndex && session.status === "playing",
      availableActions: i === session.activeHandIndex && session.status === "playing"
        ? getAvailableActions(h, session.playerHands.length)
        : [],
    })),
    dealerHand: {
      cards: session.dealerHidden
        ? [{ rank: session.dealerHand.cards[0]!.rank, suit: session.dealerHand.cards[0]!.suit }, { rank: "?" as any, suit: "?" as any }]
        : session.dealerHand.cards.map(c => ({ rank: c.rank, suit: c.suit })),
      total: session.dealerHidden ? session.dealerHand.cards[0]!.value : session.dealerHand.total,
      busted: session.dealerHidden ? false : session.dealerHand.busted,
      blackjack: session.dealerHidden ? false : session.dealerHand.blackjack,
    },
    betAmount: session.betAmount,
    currency: session.currency,
    results: session.results,
    roundId: session.roundId,
    serverSeedHash,
  };
}
