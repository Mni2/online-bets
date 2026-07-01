"use client";
import React, { useState, useEffect } from "react";
import { Card, Button, Badge } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";
import Link from "next/link";

interface LiveTable {
  id: string;
  slug: string;
  name: string;
  provider: string;
  dealerName: string;
  dealerAvatar: string;
  minBet: string;
  maxBet: string;
  rtp: number;
  houseEdge: number;
  status: string;
  category: string;
}

const FALLBACK_TABLES: LiveTable[] = [
  {
    id: "live-1",
    slug: "live-vip-roulette",
    name: "Monte Carlo VIP Roulette",
    provider: "Evolution",
    dealerName: "Elena",
    dealerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    minBet: "1.00",
    maxBet: "10000.00",
    rtp: 80.0,
    houseEdge: 20.0,
    status: "open",
    category: "roulette",
  },
  {
    id: "live-2",
    slug: "live-vip-blackjack",
    name: "Grand Casino VIP Blackjack",
    provider: "PragmaticLive",
    dealerName: "Victoria",
    dealerAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    minBet: "5.00",
    maxBet: "25000.00",
    rtp: 80.0,
    houseEdge: 20.0,
    status: "open",
    category: "blackjack",
  },
  {
    id: "live-3",
    slug: "live-highroller-baccarat",
    name: "Imperial High-Roller Baccarat",
    provider: "Ezugi",
    dealerName: "Sophia",
    dealerAvatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&auto=format&fit=crop&q=80",
    minBet: "10.00",
    maxBet: "50000.00",
    rtp: 80.0,
    houseEdge: 20.0,
    status: "open",
    category: "baccarat",
  },
  {
    id: "live-4",
    slug: "live-cyber-show",
    name: "Cyber Fortune Live Game Show",
    provider: "NovaStudio",
    dealerName: "Chloe",
    dealerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80",
    minBet: "0.50",
    maxBet: "15000.00",
    rtp: 80.0,
    houseEdge: 20.0,
    status: "open",
    category: "gameshow",
  },
];

export default function LiveDealerPage(): React.ReactElement {
  const [tables, setTables] = useState<LiveTable[]>(FALLBACK_TABLES);
  const [activeTable, setActiveTable] = useState<LiveTable | null>(null);
  const [selectedChip, setSelectedChip] = useState<number>(5);
  const [selectedBet, setSelectedBet] = useState<string>("red");
  const [loading, setLoading] = useState<boolean>(false);
  const [chatLog, setChatLog] = useState<string[]>([]);
  const [lastOutcome, setLastOutcome] = useState<{ won?: boolean; profit?: number; outcome?: string } | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");

  useEffect(() => {
    api<{ tables: LiveTable[] }>("/api/games/live/tables")
      .then((res) => {
        if (res?.tables) setTables(res.tables);
      })
      .catch(() => {});
  }, []);

  const handleJoinTable = async (t: LiveTable) => {
    setActiveTable(t);
    setChatLog([
      `System: Connected to secure HD video stream (${t.provider} Studio).`,
      `${t.dealerName}: "Welcome to ${t.name}! Please place your chips on the felt!"`,
    ]);
    if (t.category === "roulette") setSelectedBet("red");
    else if (t.category === "blackjack") setSelectedBet("player");
    else if (t.category === "baccarat") setSelectedBet("player");
    else setSelectedBet("cyber_bonus");

    try {
      const tokens = tokenStore.get();
      if (tokens.access) {
        const res = await api<{ token: string }>("/api/games/live/session", {
          method: "POST",
          accessToken: tokens.access,
          body: { tableSlug: t.slug },
        });
        if (res?.token) setSessionToken(res.token);
      }
    } catch {
      // Ignore session error for guest/demo browsing
    }
  };

  const handlePlaceLiveBet = async () => {
    if (!activeTable) return;
    if (!tokenStore.get()) {
      alert("Please log in to place live table bets!");
      return;
    }
    setLoading(true);
    setLastOutcome(null);
    try {
      const tokens = tokenStore.get();
      const res = await api<{
        betId: string;
        won: boolean;
        multiplier: number;
        payout: number;
        profit: number;
        dealerMessage: string;
        outcome: string;
      }>("/api/games/live/simulate", {
        method: "POST",
        accessToken: tokens.access ?? undefined,
        body: {
          tableSlug: activeTable.slug,
          amount: selectedChip,
          betType: selectedBet,
        },
      });

      if (res) {
        setLastOutcome({ won: res.won, profit: res.profit, outcome: res.outcome });
        setChatLog((prev) => [...prev.slice(-8), res.dealerMessage]);
      }
    } catch (err: any) {
      alert(`Bet failed: ${err?.message || "Check balance"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              background: "linear-gradient(135deg, #FF1744, #D50000)", color: "#fff",
              padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, letterSpacing: 1
            }}>● LIVE STUDIOS</span>
            <Badge tone="success">80.0% RTP / 20.0% House Edge</Badge>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8, background: "linear-gradient(135deg, #fff, #29e0c5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            VIP Live Dealer Casino
          </h1>
          <p style={{ color: "#a0a0b8", fontSize: 14 }}>
            Seamless wallet integration with Evolution, Pragmatic Live, and Ezugi high-stakes studios.
          </p>
        </div>
        <Link href="/lobby"><Button variant="ghost">➔ Return to Lobby</Button></Link>
      </div>

      {!activeTable ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
          {tables.map((t) => (
            <div
              key={t.id}
              className="nova-game-card"
              style={{
                background: "linear-gradient(145deg, rgba(20,20,35,0.9), rgba(30,30,55,0.7))",
                border: "1px solid rgba(124,92,255,0.3)",
                borderRadius: 16, padding: 20, position: "relative", overflow: "hidden"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <img
                  src={t.dealerAvatar}
                  alt={t.dealerName}
                  style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid #29e0c5" }}
                />
                <div>
                  <strong style={{ fontSize: 18, display: "block" }}>{t.name}</strong>
                  <span style={{ color: "#29e0c5", fontSize: 13 }}>Dealer: {t.dealerName}</span>
                  <div style={{ marginTop: 4 }}>
                    <Badge tone="neutral">{t.provider}</Badge>
                  </div>
                </div>
              </div>

              <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                <span>Min/Max: <strong>${t.minBet} - ${t.maxBet}</strong></span>
                <span style={{ color: "#00C853", fontWeight: 700 }}>{t.rtp}% RTP</span>
              </div>

              <Button
                size="lg"
                block
                style={{ background: "linear-gradient(135deg, #FF1744, #7c5cff)", fontWeight: 800, border: "none" }}
                onClick={() => handleJoinTable(t)}
              >
                JOIN VIP TABLE ➔
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
          {/* Left: HD Studio Stream UI */}
          <Card glow style={{ background: "#0a0a14", border: "1px solid rgba(41,224,197,0.4)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{
              position: "relative", height: 380, background: "radial-gradient(circle at center, #1f1f3a, #0a0a14)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.1)"
            }}>
              <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 10, zIndex: 5 }}>
                <span style={{ background: "#D50000", color: "#fff", padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
                  ● LIVE STREAM
                </span>
                <span style={{ background: "rgba(0,0,0,0.6)", color: "#29e0c5", padding: "4px 10px", borderRadius: 12, fontSize: 11 }}>
                  Table: {activeTable.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                style={{ position: "absolute", top: 16, right: 16, zIndex: 5, color: "#aaa" }}
                onClick={() => setActiveTable(null)}
              >
                ✕ Leave Table
              </Button>

              {/* Simulated Dealer Video Center */}
              <div style={{ textAlign: "center", zIndex: 2 }}>
                <img
                  src={activeTable.dealerAvatar}
                  alt={activeTable.dealerName}
                  style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", border: "3px solid #29e0c5", boxShadow: "0 0 30px rgba(41,224,197,0.4)", marginBottom: 12 }}
                />
                <h3 style={{ fontSize: 22, margin: 0 }}>Dealer {activeTable.dealerName}</h3>
                <p style={{ color: "#00C853", fontSize: 14, margin: "4px 0 0 0" }}>{activeTable.provider} VIP High-Limit Studio</p>
                {sessionToken && <span style={{ fontSize: 11, color: "#666", display: "block", marginTop: 6 }}>Token: {sessionToken.slice(0, 16)}...</span>}
              </div>

              {/* Banner Result overlay */}
              {lastOutcome && (
                <div style={{
                  position: "absolute", bottom: 20, background: lastOutcome.won ? "rgba(0,200,83,0.9)" : "rgba(229,57,53,0.9)",
                  color: "#fff", padding: "10px 24px", borderRadius: 30, fontWeight: 800, fontSize: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", zIndex: 10
                }}>
                  {lastOutcome.outcome} — {lastOutcome.won ? `WON +$${lastOutcome.profit}` : "HOUSE WINS"}
                </div>
              )}
            </div>

            {/* Chip Betting Console */}
            <div style={{ padding: 20, background: "rgba(20,20,35,0.8)" }}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "#aaa", display: "block", marginBottom: 8 }}>Select Chip Denomination ($):</span>
                <div style={{ display: "flex", gap: 10 }}>
                  {[1, 5, 25, 100, 500].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSelectedChip(val)}
                      style={{
                        padding: "10px 16px", borderRadius: 20, border: selectedChip === val ? "2px solid #29e0c5" : "1px solid #444",
                        background: selectedChip === val ? "rgba(41,224,197,0.2)" : "rgba(0,0,0,0.4)", color: "#fff", fontWeight: 800, cursor: "pointer"
                      }}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "#aaa", display: "block", marginBottom: 8 }}>Select Table Bet:</span>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {activeTable.category === "roulette" && (
                    <>
                      <button onClick={() => setSelectedBet("red")} style={{ padding: "10px 20px", borderRadius: 8, background: selectedBet === "red" ? "#E53935" : "#444", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Red (2x)</button>
                      <button onClick={() => setSelectedBet("black")} style={{ padding: "10px 20px", borderRadius: 8, background: selectedBet === "black" ? "#212121" : "#444", border: "1px solid #666", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Black (2x)</button>
                    </>
                  )}
                  {(activeTable.category === "blackjack" || activeTable.category === "baccarat") && (
                    <>
                      <button onClick={() => setSelectedBet("player")} style={{ padding: "10px 20px", borderRadius: 8, background: selectedBet === "player" ? "#29e0c5" : "#444", color: selectedBet === "player" ? "#000" : "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Player Win (2x)</button>
                      <button onClick={() => setSelectedBet("banker")} style={{ padding: "10px 20px", borderRadius: 8, background: selectedBet === "banker" ? "#7c5cff" : "#444", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Banker / Stand (2x)</button>
                    </>
                  )}
                  {activeTable.category === "gameshow" && (
                    <>
                      <button onClick={() => setSelectedBet("cyber_bonus")} style={{ padding: "10px 20px", borderRadius: 8, background: selectedBet === "cyber_bonus" ? "#7c5cff" : "#444", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Cyber 2.5x Sector</button>
                      <button onClick={() => setSelectedBet("house")} style={{ padding: "10px 20px", borderRadius: 8, background: selectedBet === "house" ? "#444" : "#222", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>1x Sector</button>
                    </>
                  )}
                </div>
              </div>

              <Button
                size="lg"
                block
                disabled={loading}
                style={{ background: "linear-gradient(135deg, #00C853, #29e0c5)", color: "#000", fontWeight: 900, fontSize: 18, border: "none", height: 50 }}
                onClick={handlePlaceLiveBet}
              >
                {loading ? "DEALING ROUND..." : `CONFIRM $${selectedChip} CHIP BET ➔`}
              </Button>
            </div>
          </Card>

          {/* Right: Dealer Live Chat & Activity Log */}
          <Card style={{ background: "#111122", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", height: 600 }}>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 10, marginBottom: 12 }}>
              <strong style={{ fontSize: 16, color: "#29e0c5" }}>💬 Live Table Chat</strong>
              <span style={{ display: "block", fontSize: 11, color: "#888", marginTop: 2 }}>Audited 80% RTP Seamless Feed</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {chatLog.map((msg, i) => {
                const isDealer = msg.includes(activeTable.dealerName);
                return (
                  <div
                    key={i}
                    style={{
                      padding: "8px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.4,
                      background: isDealer ? "rgba(41,224,197,0.1)" : "rgba(255,255,255,0.05)",
                      borderLeft: isDealer ? "3px solid #29e0c5" : "3px solid #666"
                    }}
                  >
                    {msg}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
