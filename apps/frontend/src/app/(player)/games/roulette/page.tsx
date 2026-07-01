"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Card, Button, Badge } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";

// ─── Constants ───────────────────────────────────────────────────────────────
const NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0-36
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

// European wheel order
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

function getColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

const COLOR_MAP = { green: "#00C853", red: "#E53935", black: "#212121" };

type BetType = "straight" | "split" | "street" | "corner" | "line" | "dozen" | "column" | "color" | "parity" | "highlow";

interface PlacedBet {
  type: BetType;
  numbers: number[];
  amount: string;
  label: string;
}

interface SpinResult {
  roundId: string;
  winningNumber: number;
  winningColor: string;
  totalWager: string;
  totalPayout: string;
  bets: Array<{ type: string; numbers: number[]; amount: string; won: boolean; multiplier: number; payout: string }>;
}

interface HistoryEntry { number: number; color: string; }

// ─── Component ───────────────────────────────────────────────────────────────
export default function RoulettePage(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chipValue, setChipValue] = useState("1.00");
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const spinAngleRef = useRef(0);
  const targetAngleRef = useRef(0);
  const animatingRef = useRef(false);
  const animFrameRef = useRef<number>(0);

  // Fetch history on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ history: HistoryEntry[] }>("/api/games/roulette/history");
        setHistory(data.history ?? []);
      } catch {}
    })();
  }, []);

  // ─── Draw wheel ────────────────────────────────────────────────────────────
  const drawWheel = useCallback((angle: number, highlight?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = Math.min(cx, cy) - 8;
    const segAngle = (2 * Math.PI) / 37;

    // Background
    ctx.fillStyle = "#0D0D0D";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw segments
    for (let i = 0; i < 37; i++) {
      const num = WHEEL_ORDER[i]!;
      const startA = angle + i * segAngle;
      const endA = startA + segAngle;
      const color = getColor(num);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startA, endA);
      ctx.closePath();

      // Highlighted winning segment glow
      if (highlight !== undefined && num === highlight) {
        ctx.fillStyle = "#FFD700";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#FFD700";
      } else {
        ctx.fillStyle = COLOR_MAP[color];
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Segment border
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Number label
      const midA = startA + segAngle / 2;
      const labelR = radius * 0.82;
      const lx = cx + Math.cos(midA) * labelR;
      const ly = cy + Math.sin(midA) * labelR;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(midA + Math.PI / 2);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num.toString(), 0, 0);
      ctx.restore();
    }

    // Inner circle
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.38);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(1, "#16213e");
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.38, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center text
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 16px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (highlight !== undefined) {
      ctx.font = "bold 28px Inter, sans-serif";
      ctx.fillText(highlight.toString(), cx, cy);
    } else {
      ctx.fillText("ROULETTE", cx, cy);
    }

    // Pointer triangle at top
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx - 10, 22);
    ctx.lineTo(cx + 10, 22);
    ctx.closePath();
    ctx.fill();
  }, []);

  // Initial wheel draw
  useEffect(() => {
    drawWheel(0);
  }, [drawWheel]);

  // ─── Spin animation ───────────────────────────────────────────────────────
  const animateSpin = useCallback((winningNumber: number) => {
    const winIdx = WHEEL_ORDER.indexOf(winningNumber);
    const segAngle = (2 * Math.PI) / 37;
    // Target: spin several full rotations + land on the winning segment at the top
    const extraRotations = 5 + Math.random() * 3;
    const targetAngle = -(winIdx * segAngle + segAngle / 2) - extraRotations * 2 * Math.PI;
    targetAngleRef.current = targetAngle;
    const startAngle = spinAngleRef.current;
    const totalDelta = targetAngle - startAngle;
    const duration = 4000; // 4 seconds
    const startTime = performance.now();

    animatingRef.current = true;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic for realistic deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentAngle = startAngle + totalDelta * eased;
      spinAngleRef.current = currentAngle;

      if (progress < 1) {
        drawWheel(currentAngle);
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Final frame with highlight
        drawWheel(currentAngle, winningNumber);
        animatingRef.current = false;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [drawWheel]);

  // ─── Place chip on board ───────────────────────────────────────────────────
  const addBet = (type: BetType, numbers: number[], label: string) => {
    if (spinning) return;
    setBets(prev => [...prev, { type, numbers, amount: chipValue, label }]);
    setError("");
    setResult(null);
  };

  const clearBets = () => {
    if (spinning) return;
    setBets([]);
    setResult(null);
    setError("");
  };

  const totalWager = bets.reduce((sum, b) => sum + parseFloat(b.amount), 0).toFixed(2);

  // ─── Spin ──────────────────────────────────────────────────────────────────
  const spin = async () => {
    if (spinning || bets.length === 0) return;
    setSpinning(true);
    setError("");
    setResult(null);

    try {
      const tokens = tokenStore.get();
      const data = await api<SpinResult>("/api/games/roulette/play", {
        method: "POST",
        accessToken: tokens.access ?? undefined,
        body: {
          bets: bets.map(b => ({ type: b.type, numbers: b.numbers, amount: b.amount })),
          currency: "USD",
        },
      });

      // Animate wheel
      animateSpin(data.winningNumber);

      // Wait for animation to finish
      setTimeout(() => {
        setResult(data);
        setHistory(prev => [{ number: data.winningNumber, color: data.winningColor }, ...prev].slice(0, 50));
        setSpinning(false);
      }, 4200);
    } catch (err: any) {
      setError(err?.message ?? "Spin failed");
      setSpinning(false);
    }
  };

  // ─── Board grid numbers (1-36 in 3 columns) ───────────────────────────────
  const rows: number[][] = [];
  for (let r = 0; r < 12; r++) {
    rows.push([r * 3 + 1, r * 3 + 2, r * 3 + 3]);
  }

  const chipBetsOnNumber = (n: number) => bets.filter(b => b.type === "straight" && b.numbers[0] === n).length;

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 50%, #1b2838 100%)", padding: "24px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ color: "#FFD700", fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: 2 }}>🎰 EUROPEAN ROULETTE</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "4px 0 0" }}>Single-Zero • 80% RTP • Provably Fair</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
          {/* LEFT: Wheel + History */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Wheel Canvas */}
            <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 16, padding: 16, border: "1px solid rgba(255,215,0,0.15)" }}>
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: 300, borderRadius: 12 }}
              />
            </div>

            {/* Recent History */}
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>Recent Spins</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {history.slice(0, 20).map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: "#fff",
                      background: COLOR_MAP[h.color as keyof typeof COLOR_MAP] ?? "#333",
                      border: i === 0 ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {h.number}
                  </div>
                ))}
                {history.length === 0 && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No spins yet</span>}
              </div>
            </div>
          </div>

          {/* RIGHT: Betting Board */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Chip selector + controls */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {["0.50", "1.00", "5.00", "10.00", "25.00", "100.00"].map(v => (
                <button
                  key={v}
                  onClick={() => setChipValue(v)}
                  style={{
                    padding: "8px 14px", borderRadius: 20, border: "2px solid",
                    borderColor: chipValue === v ? "#FFD700" : "rgba(255,255,255,0.15)",
                    background: chipValue === v ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
                    color: chipValue === v ? "#FFD700" : "rgba(255,255,255,0.7)",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  ${v}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button onClick={clearBets} disabled={spinning} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,50,50,0.15)", color: "#FF5252", fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>
                Clear
              </button>
            </div>

            {/* Board Grid */}
            <div style={{ background: "rgba(0,80,30,0.35)", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Zero */}
              <div style={{ display: "flex", gap: 2, marginBottom: 2 }}>
                <button
                  onClick={() => addBet("straight", [0], "0")}
                  style={{
                    flex: 1, height: 40, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)",
                    background: "#00C853", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
                    position: "relative",
                  }}
                >
                  0 {chipBetsOnNumber(0) > 0 && <span style={{ position: "absolute", top: 2, right: 4, background: "#FFD700", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}>{chipBetsOnNumber(0)}</span>}
                </button>
              </div>

              {/* Numbers 1-36 in a 12x3 grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
                {rows.map(row => row.map(n => {
                  const color = getColor(n);
                  const chips = chipBetsOnNumber(n);
                  return (
                    <button
                      key={n}
                      onClick={() => addBet("straight", [n], n.toString())}
                      style={{
                        height: 36, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)",
                        background: COLOR_MAP[color], color: "#fff", fontWeight: 700, fontSize: 14,
                        cursor: "pointer", position: "relative", transition: "transform 0.1s",
                      }}
                      onMouseOver={e => (e.currentTarget.style.transform = "scale(1.08)")}
                      onMouseOut={e => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      {n}
                      {chips > 0 && <span style={{ position: "absolute", top: 1, right: 2, background: "#FFD700", borderRadius: "50%", width: 14, height: 14, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 800 }}>{chips}</span>}
                    </button>
                  );
                }))}
              </div>

              {/* Outside bets */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginTop: 6 }}>
                <button onClick={() => addBet("dozen", [1,2,3,4,5,6,7,8,9,10,11,12], "1st 12")} style={outsideBtnStyle}>1st 12</button>
                <button onClick={() => addBet("dozen", [13,14,15,16,17,18,19,20,21,22,23,24], "2nd 12")} style={outsideBtnStyle}>2nd 12</button>
                <button onClick={() => addBet("dozen", [25,26,27,28,29,30,31,32,33,34,35,36], "3rd 12")} style={outsideBtnStyle}>3rd 12</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2, marginTop: 4 }}>
                <button onClick={() => addBet("highlow", [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18], "1-18")} style={outsideBtnStyle}>1-18</button>
                <button onClick={() => addBet("parity", [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36], "Even")} style={outsideBtnStyle}>Even</button>
                <button onClick={() => addBet("color", Array.from(RED_NUMBERS), "Red")} style={{ ...outsideBtnStyle, background: "rgba(229,57,53,0.3)", borderColor: "#E53935" }}>🔴 Red</button>
                <button onClick={() => addBet("color", Array.from(BLACK_NUMBERS), "Black")} style={{ ...outsideBtnStyle, background: "rgba(33,33,33,0.5)", borderColor: "#424242" }}>⚫ Black</button>
                <button onClick={() => addBet("parity", [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35], "Odd")} style={outsideBtnStyle}>Odd</button>
                <button onClick={() => addBet("highlow", [19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36], "19-36")} style={outsideBtnStyle}>19-36</button>
              </div>
            </div>

            {/* Current Bets Summary */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Bets: </span>
                <span style={{ color: "#FFD700", fontWeight: 700, fontSize: 14 }}>{bets.length}</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginLeft: 16 }}>Total: </span>
                <span style={{ color: "#00E676", fontWeight: 700, fontSize: 14 }}>${totalWager}</span>
              </div>
              <button
                onClick={spin}
                disabled={spinning || bets.length === 0}
                style={{
                  padding: "14px 40px", borderRadius: 12, border: "none",
                  background: spinning ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #FFD700, #FF8F00)",
                  color: spinning ? "rgba(255,255,255,0.4)" : "#000",
                  fontWeight: 800, fontSize: 16, cursor: spinning ? "not-allowed" : "pointer",
                  letterSpacing: 1, transition: "all 0.3s",
                  boxShadow: spinning ? "none" : "0 4px 20px rgba(255,215,0,0.3)",
                }}
              >
                {spinning ? "SPINNING..." : "SPIN"}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "rgba(255,50,50,0.15)", borderRadius: 8, padding: 12, border: "1px solid rgba(255,50,50,0.3)", color: "#FF5252", fontSize: 13 }}>
                ❌ {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div style={{
                background: parseFloat(result.totalPayout) > 0 ? "rgba(0,230,118,0.1)" : "rgba(255,50,50,0.08)",
                borderRadius: 12, padding: 16,
                border: `1px solid ${parseFloat(result.totalPayout) > 0 ? "rgba(0,230,118,0.3)" : "rgba(255,50,50,0.2)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: COLOR_MAP[result.winningColor as keyof typeof COLOR_MAP] ?? "#333",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 800, color: "#fff",
                    border: "3px solid #FFD700",
                  }}>
                    {result.winningNumber}
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>
                      {parseFloat(result.totalPayout) > 0 ? `💰 Won $${result.totalPayout}` : "No win this round"}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                      Wagered: ${result.totalWager} | Number: {result.winningNumber} {result.winningColor}
                    </div>
                  </div>
                </div>
                {/* Individual bet results */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.bets.map((b, i) => (
                    <span key={i} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: b.won ? "rgba(0,230,118,0.2)" : "rgba(255,255,255,0.05)",
                      color: b.won ? "#00E676" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${b.won ? "rgba(0,230,118,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                      {b.type} [{b.numbers.join(",")}] ${b.amount} → {b.won ? `$${b.payout}` : "lost"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Placed bets chips */}
            {bets.length > 0 && (
              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Active Chips</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {bets.map((b, i) => (
                    <span key={i} style={{
                      padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: "rgba(255,215,0,0.1)", color: "#FFD700",
                      border: "1px solid rgba(255,215,0,0.2)",
                    }}>
                      {b.label} ${b.amount}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const outsideBtnStyle: React.CSSProperties = {
  height: 32, borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)",
  fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
};


