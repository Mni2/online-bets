import { PrismaClient } from "@nova/database";
import { mulDecimal, subDecimal, addDecimal } from "@nova/shared";
import { deriveBustMultiplier, getMultiplierAtTime } from "../engine/math.js";
import { newServerSeed, hashServerSeed } from "../../index.js";

export type CrashState = "WAITING" | "STARTING" | "RUNNING" | "CRASHED" | "SETTLED";

export interface CrashBet {
  userId: string;
  username: string;
  amount: string;
  currency: string;
  autoCashout?: number;
}

export interface CrashPlayerSession {
  userId: string;
  username: string;
  betAmount: string;
  currency: string;
  cashedOut: boolean;
  cashoutMultiplier?: number;
  payout?: string;
  profit?: string;
  betId: string;
  autoCashout?: number;
}

export interface CrashBroadcastMessage {
  type: string;
  payload: any;
}

export class CrashGameLoop {
  private prisma: PrismaClient;
  private state: CrashState = "WAITING";
  private countdownRemaining: number = 5.0; // 5 seconds WAITING phase
  private startedAt: number = 0;
  private currentMultiplier: number = 1.00;
  private bustMultiplier: number = 1.00;
  
  private currentServerSeed: string = "";
  private currentServerSeedHash: string = "";
  private currentClientSeed: string = "nova-crash-default";
  private currentNonce: number = 1;
  private currentRoundId: string = "";

  private betQueue: CrashBet[] = [];
  private activeSessions: Map<string, CrashPlayerSession> = new Map(); // userId -> session

  private intervalId: NodeJS.Timeout | null = null;
  private houseEdgeBps: number = 2000; // 20.00% default

  // Callbacks passed by the orchestrator (Fastify Server)
  private onBroadcast: (msg: CrashBroadcastMessage) => void;
  private lockFunds: (input: { userId: string; currency: any; amount: string; referenceType: string; referenceId: string }) => Promise<void>;
  private settleFunds: (input: { userId: string; currency: any; betAmount: string; payout: string; referenceType: string; referenceId: string }) => Promise<any>;

  constructor(
    prisma: PrismaClient,
    onBroadcast: (msg: CrashBroadcastMessage) => void,
    lockFunds: any,
    settleFunds: any
  ) {
    this.prisma = prisma;
    this.onBroadcast = onBroadcast;
    this.lockFunds = lockFunds;
    this.settleFunds = settleFunds;
  }

  public async start(): Promise<void> {
    if (this.intervalId) return;

    // Load or initialize nonce from existing database rounds for "crash-arcade"
    const game = await this.prisma.game.findUnique({ where: { slug: "crash-arcade" } });
    if (game) {
      const roundCount = await this.prisma.gameRound.count({ where: { gameId: game.id } });
      this.currentNonce = roundCount + 1;
      this.houseEdgeBps = Number(game.houseEdge) * 100;
    }

    // Set up 100ms game tick loop
    this.intervalId = setInterval(() => this.tick(), 100);
    console.log("[CRASH ENGINE] Game Loop started.");
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getState() {
    return {
      state: this.state,
      countdownRemaining: this.countdownRemaining,
      currentMultiplier: this.currentMultiplier,
      serverSeedHash: this.currentServerSeedHash,
      clientSeed: this.currentClientSeed,
      nonce: this.currentNonce,
      roundId: this.currentRoundId,
      activeBets: Array.from(this.activeSessions.values()),
      queueBetsCount: this.betQueue.length,
    };
  }

  public getQueue() {
    return this.betQueue;
  }

  /**
   * Main game tick running every 100ms
   */
  private async tick(): Promise<void> {
    try {
      if (this.state === "WAITING") {
        this.countdownRemaining -= 0.1;
        if (this.countdownRemaining <= 0) {
          await this.transitionToStarting();
        } else {
          // Broadcast countdown ticks every second (when remaining ends with .0)
          if (Math.round(this.countdownRemaining * 10) % 10 === 0) {
            this.onBroadcast({
              type: "ROUND_COUNTDOWN",
              payload: { timeRemaining: Math.ceil(this.countdownRemaining) },
            });
          }
        }
      } else if (this.state === "STARTING") {
        await this.transitionToRunning();
      } else if (this.state === "RUNNING") {
        const elapsed = (Date.now() - this.startedAt) / 1000;
        this.currentMultiplier = getMultiplierAtTime(elapsed);

        if (this.currentMultiplier >= this.bustMultiplier) {
          await this.transitionToCrashed();
        } else {
          // Broadcast active multiplier ticks
          this.onBroadcast({
            type: "MULTIPLIER_UPDATE",
            payload: { multiplier: this.currentMultiplier },
          });

          // Check and trigger auto-cashouts
          await this.processAutoCashouts();
        }
      } else if (this.state === "CRASHED") {
        await this.transitionToSettled();
      } else if (this.state === "SETTLED") {
        await this.transitionToWaiting();
      }
    } catch (err) {
      console.error("[CRASH ENGINE ERROR] Tick loop crash:", err);
    }
  }

  private async transitionToStarting(): Promise<void> {
    this.state = "STARTING";
    this.countdownRemaining = 0;
    
    // Generate new seeds
    this.currentServerSeed = newServerSeed();
    this.currentServerSeedHash = hashServerSeed(this.currentServerSeed);
    this.currentClientSeed = "nova-crash-" + Math.random().toString(36).slice(2, 10);
    this.bustMultiplier = deriveBustMultiplier(
      this.currentServerSeed,
      this.currentClientSeed,
      this.currentNonce,
      this.houseEdgeBps
    );

    // Sync database Game and create GameRound record
    const game = await this.prisma.game.findUnique({ where: { slug: "crash-arcade" } });
    if (!game) {
      console.error("[CRASH ENGINE] crash-arcade game missing in DB. Run seed first.");
      return;
    }

    const round = await this.prisma.gameRound.create({
      data: {
        gameId: game.id,
        serverSeed: this.currentServerSeed,
        serverSeedHash: this.currentServerSeedHash,
        clientSeed: this.currentClientSeed,
        nonce: this.currentNonce,
      },
    });
    this.currentRoundId = round.id;

    console.log(`[CRASH ENGINE] Round ${this.currentNonce} starting. ServerSeedHash: ${this.currentServerSeedHash}. Bust: ${this.bustMultiplier}x`);
  }

  private async transitionToRunning(): Promise<void> {
    this.state = "RUNNING";
    this.startedAt = Date.now();
    this.currentMultiplier = 1.00;

    // Move queued bets to active sessions
    this.activeSessions.clear();
    for (const q of this.betQueue) {
      // Find or create pending database Bet for this user
      const game = await this.prisma.game.findUnique({ where: { slug: "crash-arcade" } });
      if (!game) continue;

      const bet = await this.prisma.bet.create({
        data: {
          userId: q.userId,
          gameId: game.id,
          roundId: this.currentRoundId,
          currency: q.currency as any,
          amount: q.amount,
          status: "pending",
          payload: { autoCashout: q.autoCashout } as object,
          serverSeedHash: this.currentServerSeedHash,
          clientSeed: this.currentClientSeed,
          nonce: this.currentNonce,
        },
      });

      // Lock user funds
      await this.lockFunds({
        userId: q.userId,
        currency: q.currency,
        amount: q.amount,
        referenceType: "bet",
        referenceId: bet.id,
      });

      this.activeSessions.set(q.userId, {
        userId: q.userId,
        username: q.username,
        betAmount: q.amount,
        currency: q.currency,
        cashedOut: false,
        betId: bet.id,
        autoCashout: q.autoCashout,
      });
    }

    // Clear the bet queue for the next round
    this.betQueue = [];

    this.onBroadcast({
      type: "ROUND_STARTED",
      payload: {
        roundId: this.currentRoundId,
        serverSeedHash: this.currentServerSeedHash,
        clientSeed: this.currentClientSeed,
        nonce: this.currentNonce,
      },
    });
  }

  private async transitionToCrashed(): Promise<void> {
    this.state = "CRASHED";
    console.log(`[CRASH ENGINE] Round crashed at ${this.currentMultiplier}x`);

    this.onBroadcast({
      type: "ROUND_CRASHED",
      payload: {
        bustMultiplier: this.bustMultiplier,
        serverSeed: this.currentServerSeed,
      },
    });
  }

  private async transitionToSettled(): Promise<void> {
    this.state = "SETTLED";

    // Settle all remaining pending/uncashed active sessions as lost
    for (const session of this.activeSessions.values()) {
      if (!session.cashedOut) {
        // Settle wallet as bet loss (settleFunds with 0 payout)
        await this.settleFunds({
          userId: session.userId,
          currency: session.currency,
          betAmount: session.betAmount,
          payout: "0",
          referenceType: "bet",
          referenceId: session.betId,
        });

        // Update database Bet
        await this.prisma.bet.update({
          where: { id: session.betId },
          data: {
            status: "lost",
            payout: "0",
            profit: `-${session.betAmount}`,
            multiplier: "0",
            serverSeed: this.currentServerSeed,
            result: { won: false, roll: this.bustMultiplier } as object,
            settledAt: new Date(),
          },
        });
      }
    }

    // Update GameRound record with results
    await this.prisma.gameRound.update({
      where: { id: this.currentRoundId },
      data: {
        settledAt: new Date(),
        result: { bustMultiplier: this.bustMultiplier, serverSeed: this.currentServerSeed } as object,
      },
    });

    this.currentNonce++;
  }

  private async transitionToWaiting(): Promise<void> {
    this.state = "WAITING";
    this.countdownRemaining = 5.0;
    this.currentMultiplier = 1.00;
    this.activeSessions.clear();

    this.onBroadcast({
      type: "ROUND_WAITING",
      payload: { timeRemaining: 5 },
    });
  }

  /**
   * Places a bet in the queue for the upcoming round.
   */
  public async queueBet(bet: CrashBet): Promise<void> {
    if (this.state !== "WAITING") {
      throw new Error("betting_closed");
    }

    // Check if user is already queued
    const duplicate = this.betQueue.some((q) => q.userId === bet.userId);
    if (duplicate) {
      throw new Error("bet_already_queued");
    }

    this.betQueue.push(bet);

    this.onBroadcast({
      type: "BET_QUEUED",
      payload: {
        userId: bet.userId,
        username: bet.username,
        amount: bet.amount,
        currency: bet.currency,
      },
    });
  }

  /**
   * Cancels a queued bet.
   */
  public cancelQueuedBet(userId: string): void {
    if (this.state !== "WAITING") {
      throw new Error("cannot_cancel_now");
    }

    const index = this.betQueue.findIndex((q) => q.userId === userId);
    if (index === -1) {
      throw new Error("no_queued_bet");
    }

    this.betQueue.splice(index, 1);

    this.onBroadcast({
      type: "BET_CANCELLED",
      payload: { userId },
    });
  }

  /**
   * Cashout an active user bet in the current running round.
   */
  public async cashoutBet(userId: string): Promise<CrashPlayerSession> {
    if (this.state !== "RUNNING") {
      throw new Error("round_not_running");
    }

    const session = this.activeSessions.get(userId);
    if (!session || session.cashedOut) {
      throw new Error("no_active_bet");
    }

    const cashoutMultiplier = this.currentMultiplier;
    const payout = mulDecimal(session.betAmount, cashoutMultiplier.toString());
    const profit = subDecimal(payout, session.betAmount);

    session.cashedOut = true;
    session.cashoutMultiplier = cashoutMultiplier;
    session.payout = payout;
    session.profit = profit;

    // Settle wallet funds (credit payout)
    await this.settleFunds({
      userId: session.userId,
      currency: session.currency,
      betAmount: session.betAmount,
      payout,
      referenceType: "bet",
      referenceId: session.betId,
    });

    // Update database Bet
    await this.prisma.bet.update({
      where: { id: session.betId },
      data: {
        status: "won",
        payout,
        profit,
        multiplier: cashoutMultiplier.toString(),
        serverSeed: this.currentServerSeed,
        result: { won: true, roll: cashoutMultiplier } as object,
        settledAt: new Date(),
      },
    });

    this.onBroadcast({
      type: "PLAYER_CASHOUT",
      payload: {
        userId: session.userId,
        username: session.username,
        multiplier: cashoutMultiplier,
        payout,
      },
    });

    return session;
  }

  /**
   * Automatically cashouts players whose threshold is met by current multiplier.
   */
  private async processAutoCashouts(): Promise<void> {
    for (const session of this.activeSessions.values()) {
      if (!session.cashedOut && session.autoCashout && this.currentMultiplier >= session.autoCashout) {
        try {
          console.log(`[CRASH ENGINE] Auto-cashing out user ${session.username} at ${session.autoCashout}x`);
          await this.cashoutBet(session.userId);
        } catch (err) {
          console.error(`[CRASH ENGINE] Auto-cashout failed for ${session.username}:`, err);
        }
      }
    }
  }
}
