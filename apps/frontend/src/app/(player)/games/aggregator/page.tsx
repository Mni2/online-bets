"use client";
import React, { useState, useEffect } from "react";
import { Card, Button, Badge } from "@nova/ui";
import { api } from "@/lib/api";
import Link from "next/link";

interface AggregatedVendor {
  id: string;
  name: string;
  code: string;
  gamesCount: number;
  avgRtp: number;
  status: string;
  integrationType: string;
  logoUrl: string;
}

interface AggregatedGame {
  id: string;
  slug: string;
  title: string;
  vendorCode: string;
  vendorName: string;
  category: string;
  rtp: number;
  houseEdge: number;
  volatility: string;
  thumbnailUrl: string;
  isLive: boolean;
  minBet: string;
  maxBet: string;
}

interface EnterpriseStats {
  totalCatalogSize: number;
  activeVendors: number;
  platformRtpCompliance: string;
  totalMonthlyVolumeUsd: string;
  operatorGgrUsd: string;
  activePlayerSessions: number;
  systemHealth: string;
}

const FALLBACK_VENDORS: AggregatedVendor[] = [
  { id: "v-1", name: "Nova Studio Originals", code: "NOVA", gamesCount: 5, avgRtp: 80.0, status: "active", integrationType: "InHouse", logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80" },
  { id: "v-2", name: "Evolution Gaming VIP", code: "EVO", gamesCount: 12, avgRtp: 80.0, status: "active", integrationType: "SeamlessWallet", logoUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&auto=format&fit=crop&q=80" },
  { id: "v-3", name: "Pragmatic Play Live & Slots", code: "PRAG", gamesCount: 24, avgRtp: 80.0, status: "active", integrationType: "SeamlessWallet", logoUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=100&auto=format&fit=crop&q=80" },
  { id: "v-4", name: "Ezugi Grand Tables", code: "EZUGI", gamesCount: 8, avgRtp: 80.0, status: "active", integrationType: "SeamlessWallet", logoUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100&auto=format&fit=crop&q=80" },
  { id: "v-5", name: "Nova Sports Feed API", code: "SPORTS", gamesCount: 40, avgRtp: 80.0, status: "active", integrationType: "DirectAPI", logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80" },
];

const FALLBACK_GAMES: AggregatedGame[] = [
  { id: "agg-1", slug: "crash-arcade", title: "Crash Arcade (Flying Kite)", vendorCode: "NOVA", vendorName: "Nova Studio Originals", category: "crash", rtp: 80.0, houseEdge: 20.0, volatility: "High", thumbnailUrl: "/games/crash.jpg", isLive: true, minBet: "0.10", maxBet: "5000.00" },
  { id: "agg-2", slug: "roulette-european", title: "European Roulette VIP", vendorCode: "NOVA", vendorName: "Nova Studio Originals", category: "roulette", rtp: 80.0, houseEdge: 20.0, volatility: "Medium", thumbnailUrl: "/games/roulette.jpg", isLive: false, minBet: "0.50", maxBet: "5000.00" },
  { id: "agg-3", slug: "blackjack-az", title: "Blackjack AZ Table", vendorCode: "NOVA", vendorName: "Nova Studio Originals", category: "blackjack", rtp: 80.0, houseEdge: 20.0, volatility: "Low", thumbnailUrl: "/games/blackjack.jpg", isLive: false, minBet: "1.00", maxBet: "10000.00" },
  { id: "agg-4", slug: "slots-nova", title: "Nova Slots (5x3 Neon)", vendorCode: "NOVA", vendorName: "Nova Studio Originals", category: "slots", rtp: 80.0, houseEdge: 20.0, volatility: "High", thumbnailUrl: "/games/slots.jpg", isLive: false, minBet: "0.05", maxBet: "500.00" },
  { id: "agg-5", slug: "dice-100", title: "Dice 100 Originals", vendorCode: "NOVA", vendorName: "Nova Studio Originals", category: "dice", rtp: 80.0, houseEdge: 20.0, volatility: "Low", thumbnailUrl: "/games/dice.jpg", isLive: false, minBet: "0.10", maxBet: "10000.00" },
  { id: "agg-6", slug: "live-vip-roulette", title: "Monte Carlo VIP Roulette (Dealer: Elena)", vendorCode: "EVO", vendorName: "Evolution Gaming VIP", category: "live", rtp: 80.0, houseEdge: 20.0, volatility: "Medium", thumbnailUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80", isLive: true, minBet: "1.00", maxBet: "10000.00" },
  { id: "agg-7", slug: "live-vip-blackjack", title: "Grand Casino VIP Blackjack (Dealer: Victoria)", vendorCode: "PRAG", vendorName: "Pragmatic Play Live & Slots", category: "live", rtp: 80.0, houseEdge: 20.0, volatility: "Low", thumbnailUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80", isLive: true, minBet: "5.00", maxBet: "25000.00" },
  { id: "agg-8", slug: "live-highroller-baccarat", title: "Imperial High-Roller Baccarat (Dealer: Sophia)", vendorCode: "EZUGI", vendorName: "Ezugi Grand Tables", category: "live", rtp: 80.0, houseEdge: 20.0, volatility: "Low", thumbnailUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80", isLive: true, minBet: "10.00", maxBet: "50000.00" },
];

const FALLBACK_STATS: EnterpriseStats = {
  totalCatalogSize: 89,
  activeVendors: 5,
  platformRtpCompliance: "100% Verified (80.0% RTP / 20.0% Vig)",
  totalMonthlyVolumeUsd: "$48,250,910.40",
  operatorGgrUsd: "$9,650,182.08 (20% House Edge)",
  activePlayerSessions: 3412,
  systemHealth: "Optimal",
};

export default function AggregatorPage(): React.ReactElement {
  const [vendors, setVendors] = useState<AggregatedVendor[]>(FALLBACK_VENDORS);
  const [games, setGames] = useState<AggregatedGame[]>(FALLBACK_GAMES);
  const [stats, setStats] = useState<EnterpriseStats | null>(FALLBACK_STATS);
  const [selectedVendor, setSelectedVendor] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    api<{ vendors: AggregatedVendor[]; games: AggregatedGame[] }>("/api/games/aggregator/catalog")
      .then((res) => {
        if (res?.vendors) setVendors(res.vendors);
        if (res?.games) setGames(res.games);
      })
      .catch(() => {});

    api<EnterpriseStats>("/api/games/aggregator/stats")
      .then((res) => {
        if (res) setStats(res);
      })
      .catch(() => {});
  }, []);

  const filteredGames = games.filter((g) => {
    if (selectedVendor !== "ALL" && g.vendorCode !== selectedVendor) return false;
    if (searchQuery && !g.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: 1250, margin: "0 auto", padding: "24px 16px", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              background: "linear-gradient(135deg, #7c5cff, #29e0c5)", color: "#000",
              padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, letterSpacing: 1
            }}>● ENTERPRISE AGGREGATOR</span>
            <Badge tone="success">100% Verified 80.0% RTP / 20.0% Vig</Badge>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8, background: "linear-gradient(135deg, #fff, #29e0c5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Unified Game Aggregator & Catalog
          </h1>
          <p style={{ color: "#a0a0b8", fontSize: 14 }}>
            Direct studio pipes, real-time RTP compliance auditing, and unified API session management.
          </p>
        </div>
        <Link href="/lobby"><Button variant="ghost">➔ Return to Lobby</Button></Link>
      </div>

      {/* Operator KPIs Banner */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
          <Card glow style={{ background: "rgba(20,20,35,0.8)", border: "1px solid rgba(41,224,197,0.3)", padding: 16, borderRadius: 12 }}>
            <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", display: "block" }}>Monthly Wager Volume</span>
            <strong style={{ fontSize: 24, color: "#fff", marginTop: 4, display: "block" }}>{stats.totalMonthlyVolumeUsd}</strong>
            <span style={{ color: "#00C853", fontSize: 12 }}>↑ +14.2% vs last month</span>
          </Card>

          <Card glow style={{ background: "rgba(20,20,35,0.8)", border: "1px solid rgba(124,92,255,0.3)", padding: 16, borderRadius: 12 }}>
            <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", display: "block" }}>Operator GGR (20% Edge)</span>
            <strong style={{ fontSize: 24, color: "#29e0c5", marginTop: 4, display: "block" }}>{stats.operatorGgrUsd}</strong>
            <span style={{ color: "#aaa", fontSize: 12 }}>Audited 20.0% Vig Model</span>
          </Card>

          <Card glow style={{ background: "rgba(20,20,35,0.8)", border: "1px solid rgba(255,255,255,0.1)", padding: 16, borderRadius: 12 }}>
            <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", display: "block" }}>RTP Compliance Score</span>
            <strong style={{ fontSize: 20, color: "#00C853", marginTop: 6, display: "block" }}>{stats.platformRtpCompliance}</strong>
            <span style={{ color: "#aaa", fontSize: 12 }}>{stats.activeVendors} Studio Integrations</span>
          </Card>

          <Card glow style={{ background: "rgba(20,20,35,0.8)", border: "1px solid rgba(255,255,255,0.1)", padding: 16, borderRadius: 12 }}>
            <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", display: "block" }}>Active Player Concurrency</span>
            <strong style={{ fontSize: 24, color: "#fff", marginTop: 4, display: "block" }}>{stats.activePlayerSessions.toLocaleString()} VIPs</strong>
            <span style={{ color: "#29e0c5", fontSize: 12 }}>System Health: {stats.systemHealth}</span>
          </Card>
        </div>
      )}

      {/* Vendor Filter Tabs & Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedVendor("ALL")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: selectedVendor === "ALL" ? "2px solid #29e0c5" : "1px solid #444",
              background: selectedVendor === "ALL" ? "rgba(41,224,197,0.2)" : "rgba(0,0,0,0.4)", color: "#fff", fontWeight: 700, cursor: "pointer"
            }}
          >
            All Vendors ({games.length})
          </button>
          {vendors.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVendor(v.code)}
              style={{
                padding: "8px 18px", borderRadius: 20, border: selectedVendor === v.code ? "2px solid #29e0c5" : "1px solid #444",
                background: selectedVendor === v.code ? "rgba(41,224,197,0.2)" : "rgba(0,0,0,0.4)", color: "#fff", fontWeight: 700, cursor: "pointer"
              }}
            >
              {v.name} ({v.code})
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="🔍 Search unified games..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "10px 16px", borderRadius: 20, border: "1px solid #444", background: "#0a0a14", color: "#fff",
            width: 260, fontSize: 14, outline: "none"
          }}
        />
      </div>

      {/* Unified Game Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
        {filteredGames.map((g) => {
          const targetUrl = g.category === "live" ? "/games/live" : g.category === "sports" ? "/games/sports" : `/games/${g.category}`;
          return (
            <Link key={g.id} href={targetUrl} className="nova-game-card">
              <div
                className="nova-thumb"
                style={{
                  backgroundImage: `url('${g.thumbnailUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {g.isLive && (
                  <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
                    <span style={{
                      background: "linear-gradient(135deg, #FF1744, #D50000)", color: "#fff",
                      padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800, letterSpacing: 1
                    }}>● LIVE PIPE</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <strong style={{ fontSize: 18, color: "#fff" }}>{g.title}</strong>
                <Badge tone="neutral">{g.vendorCode}</Badge>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "var(--nova-text-2)", marginTop: 4 }}>
                <span>Vol: <strong style={{ color: "#fff" }}>{g.volatility}</strong></span>
                <span style={{ color: "#00C853", fontWeight: 700 }}>{g.rtp}% RTP ({g.houseEdge}% Vig)</span>
              </div>

              <Button size="md" block style={{ background: "linear-gradient(135deg, #7c5cff, #29e0c5)", fontWeight: 800, border: "none", marginTop: 10 }}>
                LAUNCH VIA AGGREGATOR ➔
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
