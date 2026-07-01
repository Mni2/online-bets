"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { Card, Input, Button, Badge, Stat } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";

interface CrashPlayerSession {
  userId: string;
  username: string;
  betAmount: string;
  currency: string;
  cashedOut: boolean;
  cashoutMultiplier?: number;
  payout?: string;
  profit?: string;
}

interface CrashStateDTO {
  state: "WAITING" | "STARTING" | "RUNNING" | "CRASHED" | "SETTLED";
  countdownRemaining: number;
  currentMultiplier: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  roundId: string;
  activeBets: CrashPlayerSession[];
  queueBetsCount: number;
}

export default function CrashPage(): React.ReactElement {
  const [amount, setAmount] = useState("1.00");
  const [autoCashout, setAutoCashout] = useState("");
  const [gameState, setGameState] = useState<CrashStateDTO>({
    state: "WAITING",
    countdownRemaining: 5.0,
    currentMultiplier: 1.00,
    serverSeedHash: "",
    clientSeed: "",
    nonce: 1,
    roundId: "",
    activeBets: [],
    queueBetsCount: 0,
  });

  const [activeBetsList, setActiveBetsList] = useState<CrashPlayerSession[]>([]);
  const [recentBusts, setRecentBusts] = useState<number[]>([1.45, 12.02, 1.05, 3.44, 2.10, 1.95, 23.40]);
  const [queued, setQueued] = useState(false);
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const access = tokenStore.get().access;

  // Retrieve user sub from JWT token if logged in
  const userSub = useMemo(() => {
    if (!access) return null;
    try {
      const part = access.split(".")[1];
      if (!part) return null;
      const payload = JSON.parse(atob(part));
      return payload.sub as string;
    } catch {
      return null;
    }
  }, [access]);

  // Connect WebSockets
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, "")
      : "localhost:4000";
    
    const socketUrl = `${protocol}//${host}/api/games/crash/ws${access ? `?token=${access}` : ""}`;
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "CRASH_STATE") {
        const payload = data.payload as CrashStateDTO;
        setGameState(payload);
        setActiveBetsList(payload.activeBets);
        
        // Re-sync local states if user is connected
        if (userSub) {
          const userSession = payload.activeBets.find((b) => b.userId === userSub);
          setHasActiveBet(!!userSession);
          setCashedOut(userSession?.cashedOut ?? false);
        }
      } else if (data.type === "ROUND_COUNTDOWN") {
        setGameState((prev) => ({
          ...prev,
          state: "WAITING",
          countdownRemaining: data.payload.timeRemaining,
          currentMultiplier: 1.00,
        }));
      } else if (data.type === "ROUND_STARTED") {
        setGameState((prev) => ({
          ...prev,
          state: "RUNNING",
          currentMultiplier: 1.00,
          roundId: data.payload.roundId,
          serverSeedHash: data.payload.serverSeedHash,
          clientSeed: data.payload.clientSeed,
          nonce: data.payload.nonce,
        }));
        setActiveBetsList([]);
        setCashedOut(false);
        setError(null);
        startTimeRef.current = Date.now();
      } else if (data.type === "MULTIPLIER_UPDATE") {
        const mult = data.payload.multiplier;
        setGameState((prev) => ({ ...prev, currentMultiplier: mult }));
      } else if (data.type === "BET_QUEUED") {
        const newBet = data.payload;
        if (userSub && newBet.userId === userSub) {
          setQueued(true);
        }
        setActiveBetsList((prev) => {
          const exists = prev.some((b) => b.userId === newBet.userId);
          if (exists) return prev;
          return [...prev, {
            userId: newBet.userId,
            username: newBet.username,
            betAmount: newBet.amount,
            currency: newBet.currency,
            cashedOut: false,
          }];
        });
      } else if (data.type === "BET_CANCELLED") {
        if (userSub && data.payload.userId === userSub) {
          setQueued(false);
        }
        setActiveBetsList((prev) => prev.filter((b) => b.userId !== data.payload.userId));
      } else if (data.type === "PLAYER_CASHOUT") {
        const cashout = data.payload;
        if (userSub && cashout.userId === userSub) {
          setCashedOut(true);
        }
        setActiveBetsList((prev) =>
          prev.map((b) =>
            b.userId === cashout.userId
              ? { ...b, cashedOut: true, cashoutMultiplier: cashout.multiplier, payout: cashout.payout, profit: (Number(cashout.payout) - Number(b.betAmount)).toFixed(2) }
              : b
          )
        );
      } else if (data.type === "ROUND_CRASHED") {
        const { bustMultiplier } = data.payload;
        setGameState((prev) => ({
          ...prev,
          state: "CRASHED",
          currentMultiplier: bustMultiplier,
        }));
        setRecentBusts((prev) => [bustMultiplier, ...prev.slice(0, 9)]);
        setQueued(false);
        setHasActiveBet(false);
      } else if (data.type === "ROUND_WAITING") {
        setGameState((prev) => ({
          ...prev,
          state: "WAITING",
          countdownRemaining: data.payload.timeRemaining,
          currentMultiplier: 1.00,
        }));
        setActiveBetsList([]);
      } else if (data.type === "ERROR") {
        setError(data.payload.message);
      }
    };

    return () => {
      ws.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [access, userSub]);

  // Render Canvas Animations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw dynamic dark grid background
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw bottom and left axis lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 10);
      ctx.lineTo(40, height - 30);
      ctx.lineTo(width - 10, height - 30);
      ctx.stroke();

      if (gameState.state === "RUNNING") {
        const elapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
        
        // Scale curve viewport dynamically based on elapsed time
        const maxTime = Math.max(10, elapsed);
        const maxMult = Math.max(2, gameState.currentMultiplier);

        const mapX = (t: number) => 40 + (t / maxTime) * (width - 60);
        const mapY = (m: number) => height - 30 - ((m - 1) / (maxMult - 1)) * (height - 60);

        // Draw graph growth curve
        ctx.strokeStyle = "cyan";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(mapX(0), mapY(1));

        for (let t = 0; t <= elapsed; t += 0.1) {
          const m = Math.pow(Math.E, 0.06 * t);
          ctx.lineTo(mapX(t), mapY(m));
        }
        ctx.lineTo(mapX(elapsed), mapY(gameState.currentMultiplier));
        ctx.stroke();

        // Draw glowing rocket node
        const rocketX = mapX(elapsed);
        const rocketY = mapY(gameState.currentMultiplier);
        
        ctx.fillStyle = "#00FFFF";
        ctx.beginPath();
        ctx.arc(rocketX, rocketY, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00FFFF";
        ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
        ctx.beginPath();
        ctx.arc(rocketX, rocketY, 16, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState.state, gameState.currentMultiplier]);

  // REST handlers for instant fallbacks
  const placeBet = async () => {
    if (!access) { setError("Sign in first."); return; }
    setError(null);
    try {
      await api("/api/games/crash/bet", {
        method: "POST",
        body: {
          amount,
          currency: "USD",
          autoCashout: autoCashout ? parseFloat(autoCashout) : undefined,
        },
        accessToken: access,
      });
      setQueued(true);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancelBet = async () => {
    if (!access) return;
    setError(null);
    try {
      await api("/api/games/crash/cancel-bet", {
        method: "POST",
        accessToken: access,
      });
      setQueued(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cashout = async () => {
    if (!access) return;
    setError(null);
    try {
      await api("/api/games/crash/cashout", {
        method: "POST",
        accessToken: access,
      });
      setCashedOut(true);
      setHasActiveBet(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px" }}>
      {/* Recent bust multipliers tape */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
        {recentBusts.map((b, i) => (
          <Badge
            key={i}
            tone={b >= 2.0 ? "success" : b === 1.0 ? "danger" : "neutral"}
            style={{ fontSize: 13, fontWeight: "bold", padding: "6px 12px", minWidth: 60, textAlign: "center" }}
          >
            {b.toFixed(2)}x
          </Badge>
        ))}
      </div>

      <div className="nova-grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Left Side: Game Canvas & State Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ position: "relative", height: 350, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />

            {/* Central Giant Status overlay */}
            <div style={{ zIndex: 10, textAlign: "center", pointerEvents: "none" }}>
              {gameState.state === "WAITING" && (
                <div>
                  <h3 style={{ color: "var(--nova-text-2)", margin: 0, textTransform: "uppercase" }}>Next Round In</h3>
                  <h1 style={{ fontSize: 64, margin: "8px 0 0 0", color: "#FFB000", fontFamily: "Outfit, sans-serif" }}>
                    {gameState.countdownRemaining.toFixed(1)}s
                  </h1>
                </div>
              )}

              {gameState.state === "STARTING" && (
                <h1 style={{ fontSize: 44, color: "#FFB000", margin: 0 }}>Starting...</h1>
              )}

              {gameState.state === "RUNNING" && (
                <div>
                  <h1 style={{ fontSize: 72, margin: 0, color: "#00FFFF", fontWeight: 800, textShadow: "0 0 10px rgba(0,255,255,0.4)" }}>
                    {gameState.currentMultiplier.toFixed(2)}x
                  </h1>
                </div>
              )}

              {gameState.state === "CRASHED" && (
                <div>
                  <h3 style={{ color: "#FF5F5F", margin: 0, textTransform: "uppercase" }}>Crashed at</h3>
                  <h1 style={{ fontSize: 72, margin: 0, color: "#FF5F5F", fontWeight: 800 }}>
                    {gameState.currentMultiplier.toFixed(2)}x
                  </h1>
                </div>
              )}

              {gameState.state === "SETTLED" && (
                <h1 style={{ fontSize: 44, color: "var(--nova-text-2)", margin: 0 }}>Settling round...</h1>
              )}
            </div>
          </Card>
        </div>

        {/* Right Side: Bet Control Panel */}
        <Card padded>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Control panel</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input
              label="Bet amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={queued || hasActiveBet}
              placeholder="1.00"
            />

            <Input
              label="Auto cashout multiplier (Optional)"
              value={autoCashout}
              onChange={(e) => setAutoCashout(e.target.value)}
              disabled={queued || hasActiveBet}
              placeholder="e.g. 2.00"
            />

            {error && (
              <div style={{ color: "var(--nova-danger)", fontSize: 13, backgroundColor: "rgba(255,0,0,0.1)", padding: 8, borderRadius: 4 }}>
                {error}
              </div>
            )}

            {/* Interactive Bet Buttons based on state */}
            {gameState.state === "WAITING" ? (
              queued ? (
                <Button variant="danger" block onClick={cancelBet}>Cancel queued bet</Button>
              ) : (
                <Button block onClick={placeBet}>Place bet</Button>
              )
            ) : gameState.state === "RUNNING" && hasActiveBet && !cashedOut ? (
              <Button
                block
                style={{ backgroundColor: "#FFB000", color: "#111", fontWeight: "bold" }}
                onClick={cashout}
              >
                Cashout ({(Number(amount) * gameState.currentMultiplier).toFixed(2)} USD)
              </Button>
            ) : (
              <Button block disabled={queued} onClick={placeBet}>
                {queued ? "Bet queued for next round" : "Bet for next round"}
              </Button>
            )}

            {cashedOut && (
              <div style={{ color: "var(--nova-success)", textAlign: "center", fontWeight: "bold", fontSize: 14 }}>
                Cashed out successfully!
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Panel: Players Table */}
      <Card style={{ marginTop: 24 }} padded>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Active players ({activeBetsList.length})</h3>
        
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "var(--nova-text-2)" }}>
              <th style={{ padding: "8px 0" }}>User</th>
              <th style={{ padding: "8px 0" }}>Bet amount</th>
              <th style={{ padding: "8px 0" }}>Cashout</th>
              <th style={{ padding: "8px 0" }}>Profit</th>
            </tr>
          </thead>
          <tbody>
            {activeBetsList.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "16px 0", textAlign: "center", color: "var(--nova-text-2)" }}>
                  Waiting for players to place bets...
                </td>
              </tr>
            ) : (
              activeBetsList.map((player, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "10px 0" }}>{player.username}</td>
                  <td style={{ padding: "10px 0" }}>{player.betAmount} {player.currency}</td>
                  <td style={{ padding: "10px 0", color: player.cashedOut ? "var(--nova-success)" : "inherit" }}>
                    {player.cashedOut ? `${player.cashoutMultiplier?.toFixed(2)}x` : "-"}
                  </td>
                  <td style={{ padding: "10px 0", color: player.cashedOut ? "var(--nova-success)" : "inherit" }}>
                    {player.cashedOut ? `+$${player.profit}` : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
