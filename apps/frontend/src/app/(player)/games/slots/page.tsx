"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { api, tokenStore } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PaylineResult {
  paylineIndex: number;
  matchCount: number;
  symbol: string;
  multiplier: number;
  payout: string;
}

interface SpinResultDTO {
  roundId: string;
  reels: string[][];
  paylines: PaylineResult[];
  totalMultiplier: number;
  totalWager: string;
  totalPayout: string;
  lines: number;
  betPerLine: string;
}

const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "⭐", "💎", "7️⃣", "🃏"];

// ─── Component ───────────────────────────────────────────────────────────────
export default function SlotsPage(): React.ReactElement {
  const [betPerLine, setBetPerLine] = useState("0.10");
  const [lines, setLines] = useState(20);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResultDTO | null>(null);
  const [displayReels, setDisplayReels] = useState<string[][]>([
    ["🍒", "🍋", "🍊"], ["🔔", "⭐", "🍇"], ["💎", "7️⃣", "🍒"], ["🍋", "🍊", "🔔"], ["⭐", "🍇", "💎"]
  ]);
  const [error, setError] = useState("");
  const animIntervals = useRef<NodeJS.Timeout[]>([]);

  const totalBet = (parseFloat(betPerLine) * lines).toFixed(2);
  const getToken = () => tokenStore.get().access ?? undefined;

  // ─── Spin animation ───────────────────────────────────────────────────────
  const animateReels = useCallback((finalReels: string[][]) => {
    // Start rapid cycling on all reels
    const shuffled = SYMBOLS.sort(() => Math.random() - 0.5);

    for (let r = 0; r < 5; r++) {
      const interval = setInterval(() => {
        setDisplayReels(prev => {
          const next = [...prev];
          next[r] = [
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!,
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!,
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!,
          ];
          return next;
        });
      }, 80);
      animIntervals.current.push(interval);

      // Stop each reel sequentially (reel 0 stops first, reel 4 last)
      setTimeout(() => {
        clearInterval(interval);
        setDisplayReels(prev => {
          const next = [...prev];
          next[r] = finalReels[r]!;
          return next;
        });
      }, 600 + r * 400);
    }
  }, []);

  // Cleanup intervals
  useEffect(() => {
    return () => animIntervals.current.forEach(clearInterval);
  }, []);

  // ─── Spin ──────────────────────────────────────────────────────────────────
  const spin = useCallback(async () => {
    if (spinning) return;
    setSpinning(true);
    setError("");
    setResult(null);

    try {
      const data = await api<SpinResultDTO>("/api/games/slots/spin", {
        method: "POST",
        accessToken: getToken(),
        body: { betPerLine, currency: "USD", lines },
      });

      // Animate reels
      animateReels(data.reels);

      // Show result after animation
      setTimeout(() => {
        setResult(data);
        setSpinning(false);
      }, 600 + 5 * 400 + 200);
    } catch (err: any) {
      setError(err?.message ?? "Spin failed");
      setSpinning(false);
    }
  }, [betPerLine, lines, spinning, animateReels]);

  const isWin = result && parseFloat(result.totalPayout) > 0;

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a0533 0%, #2d1b4e 40%, #0d0d2b 100%)", padding: "24px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ color: "#E040FB", fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: 3, textShadow: "0 0 20px rgba(224,64,251,0.4)" }}>
            🎰 NOVA SLOTS
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "4px 0 0" }}>5 Reels • 20 Paylines • 80% RTP • Provably Fair</p>
        </div>

        {/* Slot Machine Frame */}
        <div style={{
          background: "linear-gradient(180deg, #2a1a4a 0%, #1a0a3a 100%)",
          borderRadius: 20, padding: 24,
          border: "2px solid rgba(224,64,251,0.2)",
          boxShadow: "0 0 40px rgba(224,64,251,0.1), inset 0 0 60px rgba(0,0,0,0.3)",
          marginBottom: 20,
        }}>
          {/* Reels */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6,
            background: "rgba(0,0,0,0.5)", borderRadius: 12, padding: 12,
            border: "1px solid rgba(255,255,255,0.05)",
          }}>
            {displayReels.map((reel, reelIdx) => (
              <div key={reelIdx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {reel.map((symbol, rowIdx) => {
                  // Check if this cell is part of a winning payline
                  const isWinning = result?.paylines.some(pl => {
                    // Simple check: if this reel position contributed to a win
                    return pl.paylineIndex >= 0 && pl.matchCount > reelIdx;
                  });

                  return (
                    <div
                      key={rowIdx}
                      style={{
                        height: 80, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 40,
                        background: isWinning && !spinning
                          ? "rgba(224,64,251,0.15)"
                          : "rgba(255,255,255,0.03)",
                        borderRadius: 8,
                        border: isWinning && !spinning
                          ? "1px solid rgba(224,64,251,0.4)"
                          : "1px solid rgba(255,255,255,0.04)",
                        transition: "all 0.3s",
                        animation: spinning ? "pulse 0.15s ease-in-out infinite" : undefined,
                      }}
                    >
                      {symbol}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Win display */}
          {result && (
            <div style={{
              textAlign: "center", marginTop: 16, padding: "12px 0",
              background: isWin ? "rgba(224,64,251,0.1)" : "transparent",
              borderRadius: 8,
            }}>
              {isWin ? (
                <>
                  <div style={{ color: "#E040FB", fontSize: 28, fontWeight: 800, textShadow: "0 0 15px rgba(224,64,251,0.5)" }}>
                    💰 WIN ${result.totalPayout}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
                    {result.paylines.length} payline{result.paylines.length > 1 ? "s" : ""} hit • {result.totalMultiplier.toFixed(1)}× total multiplier
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 8 }}>
                    {result.paylines.map((pl, i) => (
                      <span key={i} style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: "rgba(224,64,251,0.15)", color: "#E040FB",
                        border: "1px solid rgba(224,64,251,0.25)",
                      }}>
                        Line {pl.paylineIndex + 1}: {pl.symbol}×{pl.matchCount} → {pl.multiplier}× (${pl.payout})
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No win — try again!</div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{
          background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: 20,
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center",
        }}>
          {/* Bet per line */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Bet / Line</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["0.05", "0.10", "0.50", "1.00", "5.00"].map(v => (
                <button
                  key={v}
                  onClick={() => setBetPerLine(v)}
                  disabled={spinning}
                  style={{
                    padding: "6px 12px", borderRadius: 8,
                    border: `1px solid ${betPerLine === v ? "#E040FB" : "rgba(255,255,255,0.1)"}`,
                    background: betPerLine === v ? "rgba(224,64,251,0.15)" : "rgba(255,255,255,0.03)",
                    color: betPerLine === v ? "#E040FB" : "rgba(255,255,255,0.6)",
                    fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Lines */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Lines</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 5, 10, 15, 20].map(l => (
                <button
                  key={l}
                  onClick={() => setLines(l)}
                  disabled={spinning}
                  style={{
                    padding: "6px 12px", borderRadius: 8,
                    border: `1px solid ${lines === l ? "#E040FB" : "rgba(255,255,255,0.1)"}`,
                    background: lines === l ? "rgba(224,64,251,0.15)" : "rgba(255,255,255,0.03)",
                    color: lines === l ? "#E040FB" : "rgba(255,255,255,0.6)",
                    fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Total & Spin */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Total Bet</div>
            <div style={{ color: "#E040FB", fontSize: 18, fontWeight: 800 }}>${totalBet}</div>
          </div>

          <button
            onClick={spin}
            disabled={spinning}
            style={{
              padding: "16px 48px", borderRadius: 14, border: "none",
              background: spinning ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #E040FB, #7C4DFF)",
              color: spinning ? "rgba(255,255,255,0.4)" : "#fff",
              fontWeight: 800, fontSize: 18, cursor: spinning ? "not-allowed" : "pointer",
              letterSpacing: 2, transition: "all 0.3s",
              boxShadow: spinning ? "none" : "0 4px 24px rgba(224,64,251,0.4)",
              textTransform: "uppercase",
            }}
          >
            {spinning ? "⏳" : "SPIN"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(255,50,50,0.15)", borderRadius: 8, padding: 12, border: "1px solid rgba(255,50,50,0.3)", color: "#FF5252", fontSize: 13, textAlign: "center", marginTop: 16 }}>
            ❌ {error}
          </div>
        )}

        {/* Game Info */}
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 16 }}>
          {result?.roundId && <span>Round: {result.roundId.slice(0, 12)}… | </span>}
          <span>Wild: 🃏 | Jackpot: 7️⃣×5 = 400× | 💎×5 = 160×</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </main>
  );
}
