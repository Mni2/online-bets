"use client";
import { useState, useCallback } from "react";
import { api, tokenStore } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CardDTO { rank: string; suit: string; }
interface HandDTO {
  cards: CardDTO[];
  total: number;
  soft: boolean;
  busted: boolean;
  blackjack: boolean;
  stood: boolean;
  doubled: boolean;
  surrendered: boolean;
  isActive: boolean;
  availableActions: string[];
}
interface DealerDTO {
  cards: CardDTO[];
  total: number;
  busted: boolean;
  blackjack: boolean;
}
interface ResultDTO {
  handIndex: number;
  outcome: string;
  payout: string;
  multiplier: number;
}
interface GameStateDTO {
  status: string;
  playerHands: HandDTO[];
  dealerHand: DealerDTO;
  betAmount: string;
  currency: string;
  results: ResultDTO[];
  roundId: string;
  serverSeedHash: string;
  serverSeed?: string;
  totalPayout?: string;
  totalBetAmount?: string;
}

// ─── Card rendering ──────────────────────────────────────────────────────────
const SUIT_SYMBOLS: Record<string, string> = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const SUIT_COLORS: Record<string, string> = { hearts: "#E53935", diamonds: "#E53935", clubs: "#fff", spades: "#fff" };

function CardView({ card, hidden }: { card: CardDTO; hidden?: boolean }) {
  if (hidden || card.rank === "?") {
    return (
      <div style={{
        width: 72, height: 100, borderRadius: 8, background: "linear-gradient(135deg, #1a237e, #283593)",
        border: "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, color: "rgba(255,255,255,0.3)", fontWeight: 800, boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}>?</div>
    );
  }
  const color = SUIT_COLORS[card.suit] ?? "#fff";
  const symbol = SUIT_SYMBOLS[card.suit] ?? "";
  return (
    <div style={{
      width: 72, height: 100, borderRadius: 8, background: "#fafafa",
      border: "2px solid rgba(255,255,255,0.2)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      position: "relative", transition: "transform 0.3s",
    }}>
      <span style={{ position: "absolute", top: 4, left: 6, fontSize: 13, fontWeight: 800, color }}>{card.rank}</span>
      <span style={{ fontSize: 28, color }}>{symbol}</span>
      <span style={{ position: "absolute", bottom: 4, right: 6, fontSize: 13, fontWeight: 800, color, transform: "rotate(180deg)" }}>{card.rank}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function BlackjackPage(): React.ReactElement {
  const [betAmount, setBetAmount] = useState("5.00");
  const [gameState, setGameState] = useState<GameStateDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getToken = () => tokenStore.get().access ?? undefined;

  // ─── Deal ──────────────────────────────────────────────────────────────────
  const deal = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<GameStateDTO>("/api/games/blackjack/deal", {
        method: "POST",
        accessToken: getToken(),
        body: { amount: betAmount, currency: "USD" },
      });
      setGameState(data);
    } catch (err: any) {
      setError(err?.message ?? "Deal failed");
    } finally {
      setLoading(false);
    }
  }, [betAmount]);

  // ─── Action ────────────────────────────────────────────────────────────────
  const doAction = useCallback(async (action: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await api<GameStateDTO>("/api/games/blackjack/action", {
        method: "POST",
        accessToken: getToken(),
        body: { action },
      });
      setGameState(data);
    } catch (err: any) {
      setError(err?.message ?? "Action failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const isPlaying = gameState?.status === "playing";
  const isSettled = gameState?.status === "settled";
  const activeHand = gameState?.playerHands.find(h => h.isActive);

  // ─── Calculate total result ────────────────────────────────────────────────
  const totalPayout = gameState?.totalPayout ?? "0";
  const totalBet = gameState?.totalBetAmount ?? gameState?.betAmount ?? "0";
  const netResult = isSettled ? (parseFloat(totalPayout) - parseFloat(totalBet)).toFixed(2) : "0";
  const isWin = parseFloat(netResult) > 0;

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a1a 0%, #0d2818 50%, #1b2838 100%)", padding: "24px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ color: "#00E676", fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: 2 }}>🃏 BLACKJACK AZ</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "4px 0 0" }}>6-Deck Shoe • Late Surrender • 80% RTP • Provably Fair</p>
        </div>

        {/* Dealer Area */}
        <div style={{ background: "rgba(0,80,30,0.25)", borderRadius: 16, padding: "24px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Dealer</span>
            {gameState && (
              <span style={{ color: "#FFD700", fontSize: 16, fontWeight: 700 }}>
                {gameState.dealerHand.cards[1]?.rank === "?" ? gameState.dealerHand.total : gameState.dealerHand.total}
                {gameState.dealerHand.busted && <span style={{ color: "#FF5252", marginLeft: 8 }}>BUST!</span>}
                {gameState.dealerHand.blackjack && <span style={{ color: "#FFD700", marginLeft: 8 }}>BLACKJACK!</span>}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", minHeight: 100 }}>
            {gameState ? gameState.dealerHand.cards.map((c, i) => (
              <CardView key={i} card={c} hidden={c.rank === "?"} />
            )) : (
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 72, height: 100, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }} />
                <div style={{ width: 72, height: 100, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }} />
              </div>
            )}
          </div>
        </div>

        {/* Player Hands */}
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: "24px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Your Hand{(gameState?.playerHands.length ?? 0) > 1 ? "s" : ""}</span>
          </div>

          {gameState ? (
            <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
              {gameState.playerHands.map((hand, idx) => (
                <div key={idx} style={{
                  padding: 16, borderRadius: 12,
                  border: hand.isActive ? "2px solid #00E676" : "1px solid rgba(255,255,255,0.06)",
                  background: hand.isActive ? "rgba(0,230,118,0.05)" : "transparent",
                  textAlign: "center",
                }}>
                  {gameState.playerHands.length > 1 && (
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 6 }}>Hand {idx + 1}</div>
                  )}
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
                    {hand.cards.map((c, i) => <CardView key={i} card={c} />)}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: hand.busted ? "#FF5252" : hand.blackjack ? "#FFD700" : "#fff" }}>
                    {hand.total}
                    {hand.soft && !hand.blackjack && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}> soft</span>}
                    {hand.busted && <span style={{ color: "#FF5252", marginLeft: 6 }}>BUST!</span>}
                    {hand.blackjack && <span style={{ color: "#FFD700", marginLeft: 6 }}>BLACKJACK!</span>}
                    {hand.doubled && <span style={{ color: "#FF9800", marginLeft: 6, fontSize: 12 }}>2×</span>}
                    {hand.surrendered && <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 6, fontSize: 12 }}>SURRENDERED</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", minHeight: 100 }}>
              <div style={{ width: 72, height: 100, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }} />
              <div style={{ width: 72, height: 100, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }} />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {isPlaying && activeHand && activeHand.availableActions.map(action => (
            <button
              key={action}
              onClick={() => doAction(action)}
              disabled={loading}
              style={{
                padding: "12px 28px", borderRadius: 10, border: "none",
                background: action === "hit" ? "linear-gradient(135deg, #00E676, #00C853)"
                  : action === "stand" ? "linear-gradient(135deg, #FF9800, #F57C00)"
                  : action === "double" ? "linear-gradient(135deg, #2196F3, #1976D2)"
                  : action === "split" ? "linear-gradient(135deg, #9C27B0, #7B1FA2)"
                  : "linear-gradient(135deg, #757575, #616161)",
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: 1, textTransform: "uppercase",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)", transition: "all 0.2s",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {action}
            </button>
          ))}
        </div>

        {/* Result Banner */}
        {isSettled && gameState && (
          <div style={{
            background: isWin ? "rgba(0,230,118,0.12)" : parseFloat(netResult) === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,50,50,0.1)",
            borderRadius: 12, padding: 20, marginBottom: 20, textAlign: "center",
            border: `1px solid ${isWin ? "rgba(0,230,118,0.3)" : parseFloat(netResult) === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,50,50,0.2)"}`,
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: isWin ? "#00E676" : parseFloat(netResult) === 0 ? "#FFD700" : "#FF5252" }}>
              {isWin ? `💰 WON $${totalPayout}` : parseFloat(netResult) === 0 ? "🤝 PUSH" : "😞 DEALER WINS"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>
              Bet: ${totalBet} | Payout: ${totalPayout} | Net: {parseFloat(netResult) >= 0 ? "+" : ""}{netResult}
            </div>
            {gameState.results.map((r, i) => (
              <span key={i} style={{
                display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, margin: "6px 3px 0",
                background: r.outcome === "win" || r.outcome === "blackjack" ? "rgba(0,230,118,0.15)" : r.outcome === "push" ? "rgba(255,215,0,0.1)" : "rgba(255,50,50,0.1)",
                color: r.outcome === "win" || r.outcome === "blackjack" ? "#00E676" : r.outcome === "push" ? "#FFD700" : "#FF5252",
              }}>
                {gameState.playerHands.length > 1 ? `Hand ${i+1}: ` : ""}{r.outcome.toUpperCase()} ${r.payout !== "0" ? `$${r.payout}` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Bet Controls / Deal Button */}
        {(!gameState || isSettled) && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            {/* Chip values */}
            {["1.00", "5.00", "10.00", "25.00", "50.00", "100.00"].map(v => (
              <button
                key={v}
                onClick={() => setBetAmount(v)}
                style={{
                  padding: "8px 14px", borderRadius: 20,
                  border: `2px solid ${betAmount === v ? "#00E676" : "rgba(255,255,255,0.12)"}`,
                  background: betAmount === v ? "rgba(0,230,118,0.12)" : "rgba(255,255,255,0.04)",
                  color: betAmount === v ? "#00E676" : "rgba(255,255,255,0.6)",
                  fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                ${v}
              </button>
            ))}
            <button
              onClick={deal}
              disabled={loading}
              style={{
                padding: "14px 44px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #00E676, #00C853)",
                color: "#000", fontWeight: 800, fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: 1, boxShadow: "0 4px 20px rgba(0,230,118,0.3)", transition: "all 0.3s",
              }}
            >
              {loading ? "DEALING..." : "DEAL"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(255,50,50,0.15)", borderRadius: 8, padding: 12, border: "1px solid rgba(255,50,50,0.3)", color: "#FF5252", fontSize: 13, textAlign: "center", marginBottom: 16 }}>
            ❌ {error}
          </div>
        )}

        {/* Game Info */}
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
          {gameState?.roundId && <span>Round: {gameState.roundId.slice(0, 12)}… | </span>}
          <span>Blackjack pays 1.20:1 | Win pays 0.80:1 | Dealer hits soft 17</span>
        </div>
      </div>
    </main>
  );
}
