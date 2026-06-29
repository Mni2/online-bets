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
    { id: "fallback-1", slug: "dice-100", name: "Dice 100", category: "dice", rtp: 98.5, houseEdge: 1.5, isLive: false, thumbnail: "" },
    { id: "fallback-2", slug: "crash-arcade", name: "Crash Arcade", category: "crash", rtp: 99.0, houseEdge: 1.0, isLive: true, thumbnail: "" },
  ];
  const list = games.length > 0 ? games : fallback;

  return (
    <div>
      <div className="nova-section-title">
        <h2>Game lobby</h2>
        <Badge tone="primary">{list.length} games</Badge>
      </div>

      <div className="nova-grid">
        {list.map((g) => (
          <Link key={g.id} href={`/games/${g.slug}`} className="nova-game-card">
            <div className="nova-thumb" aria-label={`${g.name} thumbnail`} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{g.name}</strong>
              {g.isLive ? <Badge tone="primary">LIVE</Badge> : <Badge tone="neutral">{g.category}</Badge>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--nova-text-2)", fontSize: 12 }}>
              <span>RTP {g.rtp.toFixed(2)}%</span>
              <span>Edge {g.houseEdge.toFixed(2)}%</span>
            </div>
            <Button size="sm" block>Play now</Button>
          </Link>
        ))}
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
