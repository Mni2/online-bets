"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, Input, Button, Badge, Stat } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";

interface DiceResultDTO {
  betId: string;
  roll: number;
  target: number;
  direction: "under" | "over";
  amount: string;
  payout: string;
  multiplier: number;
  profit: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: string;
}

export default function DicePage(): React.ReactElement {
  const [amount, setAmount] = useState("1.00");
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<"under" | "over">("under");
  const [clientSeed, setClientSeed] = useState("nova-" + Math.random().toString(36).slice(2, 10));
  const [nonce, setNonce] = useState(1);
  const [result, setResult] = useState<DiceResultDTO | null>(null);
  const [history, setHistory] = useState<DiceResultDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const access = tokenStore.get().access;

  const winChance = direction === "under" ? target - 1 : 100 - target;
  const multiplier = useMemo(() => {
    const m = 9850 / Math.max(1, winChance * 100);
    return Math.max(1.0102, Number(m.toFixed(4)));
  }, [winChance]);

  const play = async (): Promise<void> => {
    if (!access) { setError("Sign in first."); return; }
    setBusy(true); setError(null);
    try {
      const res = await api<{ result: DiceResultDTO }>("/api/games/dice/play", {
        method: "POST",
        body: { gameSlug: "dice-100", amount, currency: "USD", target, direction, clientSeed, nonce },
        accessToken: access,
      });
      setResult(res.result);
      setHistory((h) => [res.result, ...h].slice(0, 12));
      setNonce((n) => n + 1);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="nova-section-title">
        <h2>Dice 100</h2>
        <Badge tone="primary">Provably fair · 1.50% edge</Badge>
      </div>

      {!access ? (
        <Card><p>Please <Link href="/login" style={{ color: "var(--nova-primary)" }}>sign in</Link> to play for real money. Demo mode uses dummy funds.</p></Card>
      ) : null}

      <div className="nova-row">
        <Card>
          <div className="nova-dice-canvas" aria-label="Dice outcome">
            <div className="nova-dice-bar" />
            <div className="nova-dice-target" style={{ left: `${target}%` }} />
            {result ? <div className="nova-dice-roll" style={{ left: `${result.roll}%` }} /> : null}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, alignItems: "center" }}>
            <div>
              <div style={{ color: "var(--nova-text-3)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>Last roll</div>
              <div style={{ fontFamily: "var(--nova-font-mono)", fontSize: 28, fontWeight: 700 }}>
                {result ? result.roll.toFixed(2) : "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--nova-text-3)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>Target</div>
              <div style={{ fontFamily: "var(--nova-font-mono)", fontSize: 28, fontWeight: 700 }}>{target}</div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Place a bet</h3>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Input label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, color: "var(--nova-text-1)" }}>Direction</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button size="sm" variant={direction === "under" ? "primary" : "secondary"} onClick={() => setDirection("under")}>Roll under</Button>
                <Button size="sm" variant={direction === "over" ? "primary" : "secondary"} onClick={() => setDirection("over")}>Roll over</Button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--nova-text-1)" }}>
              <span style={{ fontWeight: 600 }}>Target ({target})</span>
              <input
                type="range"
                min={2}
                max={98}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <Input label="Client seed" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
          </div>

          <div className="nova-row" style={{ marginTop: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
            <Stat label="Win chance" value={`${winChance}%`} />
            <Stat label="Multiplier" value={`${multiplier.toFixed(4)}×`} />
            <Stat label="Nonce" value={String(nonce)} />
          </div>

          {error ? <p style={{ color: "var(--nova-danger)" }}>{error}</p> : null}

          <Button onClick={play} block loading={busy} size="lg" style={{ marginTop: 16 }}>Roll dice</Button>
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: "0 0 12px" }}>Recent rolls</h3>
        <Card padded>
          {history.length === 0 ? (
            <p style={{ color: "var(--nova-text-3)" }}>No rolls yet — make your first bet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((r) => (
                <div key={r.betId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--nova-border)", padding: "8px 0" }}>
                  <span style={{ fontFamily: "var(--nova-font-mono)" }}>{r.roll.toFixed(2)} {r.direction === "under" ? "<" : ">"} {r.target}</span>
                  <Badge tone={Number(r.profit) >= 0 ? "success" : "danger"}>
                    {Number(r.profit) >= 0 ? `+${r.profit}` : r.profit} {Number(r.profit) >= 0 ? "win" : "loss"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
