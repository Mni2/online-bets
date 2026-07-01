import Link from "next/link";
import { Card, Badge, Button } from "@nova/ui";
import { BRAND } from "@nova/shared";

interface GameDTO {
  id: string;
  slug: string;
  name: string;
  category: string;
  rtp: number;
  houseEdge: number;
  isLive: boolean;
  thumbnail: string;
}

async function fetchGames(): Promise<GameDTO[]> {
  try {
    let apiEndpoint = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    if (apiEndpoint && !apiEndpoint.startsWith("http://") && !apiEndpoint.startsWith("https://")) {
      apiEndpoint = `https://${apiEndpoint}`;
    }
    const res = await fetch(`${apiEndpoint}/api/games`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as GameDTO[];
  } catch {
    return [];
  }
}

export default async function LobbyPage(): Promise<React.ReactElement> {
  const games = await fetchGames();
  const fallback = [
    { id: "fallback-1", slug: "crash-arcade", name: "Crash Arcade", category: "crash", rtp: 80.0, houseEdge: 20.0, isLive: true, thumbnail: "/games/crash.jpg" },
    { id: "fallback-2", slug: "roulette-european", name: "European Roulette", category: "roulette", rtp: 80.0, houseEdge: 20.0, isLive: false, thumbnail: "/games/roulette.jpg" },
    { id: "fallback-3", slug: "blackjack-az", name: "Blackjack AZ", category: "blackjack", rtp: 80.0, houseEdge: 20.0, isLive: false, thumbnail: "/games/blackjack.jpg" },
    { id: "fallback-4", slug: "slots-nova", name: "Nova Slots", category: "slots", rtp: 80.0, houseEdge: 20.0, isLive: false, thumbnail: "/games/slots.jpg" },
    { id: "fallback-5", slug: "dice-100", name: "Dice 100", category: "dice", rtp: 80.0, houseEdge: 20.0, isLive: false, thumbnail: "/games/dice.jpg" },
  ];
  const list = games.length > 0 ? games : fallback;

  return (
    <div>
      <div className="nova-section-title">
        <h2 style={{ fontSize: 28, background: "linear-gradient(135deg, #fff, #00E676)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          🎰 VIP Game Lobby
        </h2>
        <Badge tone="primary">{list.length} games available</Badge>
      </div>

      <div className="nova-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
        {list.map((g) => {
          const bgUrl = g.thumbnail || `/games/${g.category}.jpg`;
          return (
            <Link key={g.id} href={`/games/${g.category}`} className="nova-game-card">
              <div
                className="nova-thumb"
                style={{
                  backgroundImage: `url('${bgUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                aria-label={`${g.name} thumbnail`}
              >
                {g.isLive && (
                  <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
                    <span style={{
                      background: "linear-gradient(135deg, #FF1744, #D50000)", color: "#fff",
                      padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800,
                      letterSpacing: 1, boxShadow: "0 2px 10px rgba(255,23,68,0.5)"
                    }}>● LIVE</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 18, color: "#fff" }}>{g.name}</strong>
                {g.isLive ? <Badge tone="primary">LIVE</Badge> : <Badge tone="neutral">{g.category.toUpperCase()}</Badge>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--nova-text-2)", fontSize: 12 }}>
                <span>RTP <strong style={{ color: "#00E676" }}>{g.rtp.toFixed(1)}%</strong></span>
                <span>House Edge <strong style={{ color: "#FFB547" }}>{g.houseEdge.toFixed(1)}%</strong></span>
              </div>
              <Button size="md" block style={{ background: "linear-gradient(135deg, #7c5cff, #29e0c5)", fontWeight: 700, border: "none" }}>
                PLAY NOW ➔
              </Button>
            </Link>
          );
        })}
      </div>

      <Card style={{ marginTop: 32 }}>
        <h3 style={{ marginTop: 0 }}>Provably fair</h3>
        <p style={{ color: "var(--nova-text-2)" }}>
          {BRAND.name} publishes server seed <em>hashes</em> before each round and reveals the seed after settlement.
          Combined with your client seed and nonce, anyone can re-derive the outcome using HMAC-SHA256.
        </p>
      </Card>
    </div>
  );
}
