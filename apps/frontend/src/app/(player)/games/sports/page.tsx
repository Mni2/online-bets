"use client";
import React, { useState, useEffect } from "react";
import { Card, Button, Badge } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";
import Link from "next/link";

interface SportFixture {
  id: string;
  slug: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  homeOdds: number;
  drawOdds?: number;
  awayOdds: number;
  homeScore?: number;
  awayScore?: number;
  minute?: string;
}

const FALLBACK_FIXTURES: SportFixture[] = [
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

export default function SportsbookPage(): React.ReactElement {
  const [fixtures, setFixtures] = useState<SportFixture[]>(FALLBACK_FIXTURES);
  const [selectedBet, setSelectedBet] = useState<{
    fixtureSlug: string;
    fixtureName: string;
    selection: "home" | "draw" | "away";
    selectionLabel: string;
    odds: number;
  } | null>(null);
  const [wagerAmount, setWagerAmount] = useState<string>("10.00");
  const [loading, setLoading] = useState<boolean>(false);
  const [betResult, setBetResult] = useState<{
    won: boolean;
    payout: string;
    profit: string;
    matchScore: string;
    commentary: string;
  } | null>(null);

  useEffect(() => {
    api<{ fixtures: SportFixture[] }>("/api/games/sports/fixtures")
      .then((res) => {
        if (res?.fixtures) setFixtures(res.fixtures);
      })
      .catch(() => {});
  }, []);

  const handleSelectOdd = (f: SportFixture, selection: "home" | "draw" | "away", odds: number) => {
    setBetResult(null);
    const label = selection === "home" ? f.homeTeam : selection === "away" ? f.awayTeam : "Draw";
    setSelectedBet({
      fixtureSlug: f.slug,
      fixtureName: `${f.homeTeam} vs ${f.awayTeam}`,
      selection,
      selectionLabel: label,
      odds,
    });
  };

  const handlePlaceSportsBet = async () => {
    if (!selectedBet) return;
    if (!tokenStore.get()) {
      alert("Please log in to place sports bets!");
      return;
    }
    setLoading(true);
    setBetResult(null);
    try {
      const tokens = tokenStore.get();
      const res = await api<{
        betId: string;
        status: string;
        payout: string;
        profit: string;
        matchScore: string;
        commentary: string;
      }>("/api/games/sports/bet", {
        method: "POST",
        accessToken: tokens.access ?? undefined,
        body: {
          fixtureSlug: selectedBet.fixtureSlug,
          selection: selectedBet.selection,
          amount: wagerAmount,
        },
      });

      if (res) {
        setBetResult({
          won: res.status === "won",
          payout: res.payout,
          profit: res.profit,
          matchScore: res.matchScore,
          commentary: res.commentary,
        });
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
            }}>● LIVE ODDS TICKER</span>
            <Badge tone="success">80.0% RTP / 20.0% Vig Margin</Badge>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8, background: "linear-gradient(135deg, #fff, #7c5cff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Nova Royale VIP Sportsbook
          </h1>
          <p style={{ color: "#a0a0b8", fontSize: 14 }}>
            Provably fair live match simulations & upcoming world tournament fixtures.
          </p>
        </div>
        <Link href="/lobby"><Button variant="ghost">➔ Return to Lobby</Button></Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* Left: Fixtures Ticker */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {fixtures.map((f) => (
            <Card
              key={f.id}
              glow
              style={{
                background: "linear-gradient(145deg, rgba(20,20,35,0.9), rgba(30,30,50,0.7))",
                border: "1px solid rgba(124,92,255,0.3)",
                borderRadius: 16, padding: 20
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "#29e0c5", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  🏆 {f.league} ({f.sport})
                </span>
                {f.status === "live" ? (
                  <Badge tone="primary">LIVE · {f.minute}</Badge>
                ) : (
                  <Badge tone="neutral">UPCOMING</Badge>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <strong style={{ fontSize: 20 }}>{f.homeTeam}</strong>
                  {f.status === "live" && <span style={{ fontSize: 20, fontWeight: 900, color: "#FF1744" }}>{f.homeScore}</span>}
                </div>
                <span style={{ color: "#666", fontWeight: 700 }}>vs</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {f.status === "live" && <span style={{ fontSize: 20, fontWeight: 900, color: "#FF1744" }}>{f.awayScore}</span>}
                  <strong style={{ fontSize: 20 }}>{f.awayTeam}</strong>
                </div>
              </div>

              {/* Odds Grid */}
              <div style={{ display: "grid", gridTemplateColumns: f.drawOdds ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
                <button
                  onClick={() => handleSelectOdd(f, "home", f.homeOdds)}
                  style={{
                    padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                    background: selectedBet?.fixtureSlug === f.slug && selectedBet?.selection === "home" ? "linear-gradient(135deg, #7c5cff, #29e0c5)" : "rgba(0,0,0,0.4)",
                    color: selectedBet?.fixtureSlug === f.slug && selectedBet?.selection === "home" ? "#000" : "#fff",
                    fontWeight: 800, cursor: "pointer", display: "flex", justifyContent: "space-between"
                  }}
                >
                  <span>1 ({f.homeTeam})</span>
                  <span>{f.homeOdds.toFixed(2)}</span>
                </button>

                {f.drawOdds && (
                  <button
                    onClick={() => handleSelectOdd(f, "draw", f.drawOdds!)}
                    style={{
                      padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                      background: selectedBet?.fixtureSlug === f.slug && selectedBet?.selection === "draw" ? "linear-gradient(135deg, #7c5cff, #29e0c5)" : "rgba(0,0,0,0.4)",
                      color: selectedBet?.fixtureSlug === f.slug && selectedBet?.selection === "draw" ? "#000" : "#fff",
                      fontWeight: 800, cursor: "pointer", display: "flex", justifyContent: "space-between"
                    }}
                  >
                    <span>X (Draw)</span>
                    <span>{f.drawOdds.toFixed(2)}</span>
                  </button>
                )}

                <button
                  onClick={() => handleSelectOdd(f, "away", f.awayOdds)}
                  style={{
                    padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                    background: selectedBet?.fixtureSlug === f.slug && selectedBet?.selection === "away" ? "linear-gradient(135deg, #7c5cff, #29e0c5)" : "rgba(0,0,0,0.4)",
                    color: selectedBet?.fixtureSlug === f.slug && selectedBet?.selection === "away" ? "#000" : "#fff",
                    fontWeight: 800, cursor: "pointer", display: "flex", justifyContent: "space-between"
                  }}
                >
                  <span>2 ({f.awayTeam})</span>
                  <span>{f.awayOdds.toFixed(2)}</span>
                </button>
              </div>
            </Card>
          ))}
        </div>

        {/* Right: Interactive Bet Slip */}
        <Card style={{ background: "#111122", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, height: "fit-content" }}>
          <h3 style={{ fontSize: 20, margin: "0 0 16px 0", color: "#29e0c5", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 10 }}>
            🎟️ VIP Bet Slip
          </h3>

          {!selectedBet ? (
            <div style={{ textAlign: "center", padding: "40px 10px", color: "#666" }}>
              <p>Click any match odd on the left to add it to your VIP bet slip!</p>
            </div>
          ) : (
            <div>
              <div style={{ background: "rgba(255,255,255,0.05)", padding: 14, borderRadius: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: "#aaa", display: "block" }}>{selectedBet.fixtureName}</span>
                <strong style={{ fontSize: 16, display: "block", margin: "4px 0", color: "#fff" }}>
                  Selection: {selectedBet.selectionLabel}
                </strong>
                <span style={{ fontSize: 14, color: "#00C853", fontWeight: 800 }}>
                  Odds: {selectedBet.odds.toFixed(2)} (80% RTP Vig)
                </span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: "#aaa", display: "block", marginBottom: 6 }}>Wager Amount ($):</label>
                <input
                  type="number"
                  value={wagerAmount}
                  onChange={(e) => setWagerAmount(e.target.value)}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 8, border: "1px solid #444",
                    background: "#0a0a14", color: "#fff", fontSize: 16, fontWeight: 700, outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, fontSize: 14 }}>
                <span style={{ color: "#aaa" }}>Potential Payout:</span>
                <strong style={{ color: "#29e0c5", fontSize: 18 }}>
                  ${(parseFloat(wagerAmount || "0") * selectedBet.odds).toFixed(2)}
                </strong>
              </div>

              <Button
                size="lg"
                block
                disabled={loading}
                style={{ background: "linear-gradient(135deg, #7c5cff, #29e0c5)", color: "#000", fontWeight: 900, height: 48, border: "none" }}
                onClick={handlePlaceSportsBet}
              >
                {loading ? "SIMULATING MATCH..." : "PLACE VIP SPORTS BET ➔"}
              </Button>

              {betResult && (
                <div style={{
                  marginTop: 20, padding: 16, borderRadius: 12,
                  background: betResult.won ? "rgba(0,200,83,0.15)" : "rgba(229,57,53,0.15)",
                  border: betResult.won ? "1px solid #00C853" : "1px solid #E53935"
                }}>
                  <strong style={{ color: betResult.won ? "#00C853" : "#FF1744", fontSize: 16, display: "block", marginBottom: 6 }}>
                    {betResult.won ? `🎉 WINNER! Paid $${betResult.payout}` : "❌ MATCH SETTLED - LOST"}
                  </strong>
                  <span style={{ fontSize: 13, color: "#fff", display: "block", fontWeight: 700 }}>
                    Final Score: {betResult.matchScore}
                  </span>
                  <p style={{ fontSize: 12, color: "#ccc", margin: "8px 0 0 0", lineHeight: 1.4 }}>
                    {betResult.commentary}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
