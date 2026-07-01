import Link from "next/link";
import { Card, Button, Badge } from "@nova/ui";
import { BRAND } from "@nova/shared";

const features = [
  { title: "Provably fair", body: "HMAC-SHA256 seeds are revealed after every round so anyone can verify the outcome." },
  { title: "Instant payouts", body: "Hot-wallet rails and queued withdrawal workers settle most requests in under five minutes." },
  { title: "VIP that respects your time", body: "A dedicated host, rakeback, custom bonuses, and priority queue." },
  { title: "Built for scale", body: "Modular microservices, Postgres + Redis, full audit trail, and zero-downtime migrations." },
];

const games = [
  { slug: "dice", name: "Dice 100", tag: "Originals", desc: "Roll under or over. 80.0% RTP / 20% Edge.", thumb: "/games/dice.jpg" },
  { slug: "crash", name: "Crash Arcade", tag: "Live", desc: "Cash out before the kite flies away. 80% RTP.", thumb: "/games/crash.jpg" },
  { slug: "roulette", name: "European Roulette", tag: "Live", desc: "Single-zero VIP wheel. 80% RTP.", thumb: "/games/roulette.jpg" },
  { slug: "blackjack", name: "Blackjack AZ", tag: "Table", desc: "6-deck shoe, double & surrender. 80% RTP.", thumb: "/games/blackjack.jpg" },
  { slug: "slots", name: "Nova Slots", tag: "Slots", desc: "5x3 Neon Reels, 20 paylines. 80% RTP.", thumb: "/games/slots.jpg" },
  { slug: "live", name: "VIP Live Dealer", tag: "Live Studio", desc: "HD streaming video simulation. 80% RTP.", thumb: "/games/live.jpg" },
  { slug: "sports", name: "VIP Sportsbook", tag: "Sports", desc: "Live match odds & virtual simulation. 80% RTP.", thumb: "/games/sports.jpg" },
  { slug: "aggregator", name: "Game Aggregator", tag: "Enterprise", desc: "Unified studio catalog & operator KPIs.", thumb: "/games/aggregator.jpg" },
];

export default function HomePage(): React.ReactElement {
  return (
    <div>
      <section className="nova-hero">
        <div>
          <Badge tone="primary">New · Nova Royale v0.1</Badge>
          <h1 style={{ marginTop: 16 }}>{BRAND.name}</h1>
          <p>{BRAND.tagline} A modular, audited casino platform engineered for fairness, speed, and serious operators.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/register"><Button size="lg">Create account</Button></Link>
            <Link href="/lobby"><Button size="lg" variant="secondary">Explore lobby</Button></Link>
          </div>
          <div style={{ marginTop: 28, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Badge tone="success">18+ only</Badge>
            <Badge tone="warning">KYC required</Badge>
            <Badge tone="primary">Curacao + MGA ready</Badge>
            <Badge tone="neutral">PCI-DSS scope: SAQ-A</Badge>
          </div>
        </div>
        <Card glow padded>
          <div className="nova-dice-canvas" aria-hidden>
            <div className="nova-dice-bar" />
            <div className="nova-dice-target" style={{ left: "64%" }} />
            <div className="nova-dice-roll" style={{ left: "47%" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <span className="nova-pill">Last roll · 47.21</span>
            <span className="nova-pill">Server seed verified</span>
          </div>
        </Card>
      </section>

      <section>
        <div className="nova-section-title">
          <h2 style={{ fontSize: 28, background: "linear-gradient(135deg, #fff, #7c5cff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            🔥 Featured VIP Games
          </h2>
          <Link href="/lobby"><Button variant="ghost">All games ➔</Button></Link>
        </div>
        <div className="nova-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
          {games.map((g) => (
            <Link key={g.slug} href={`/games/${g.slug}`} className="nova-game-card">
              <div
                className="nova-thumb"
                style={{
                  backgroundImage: `url('${g.thumb}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                aria-label={`${g.name} thumbnail`}
              >
                {g.tag === "Live" && (
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
                <Badge tone={g.tag === "Live" ? "primary" : "neutral"}>{g.tag}</Badge>
              </div>
              <span style={{ color: "var(--nova-text-2)", fontSize: 13 }}>{g.desc}</span>
              <Button size="md" block style={{ background: "linear-gradient(135deg, #7c5cff, #29e0c5)", fontWeight: 700, border: "none", marginTop: 4 }}>
                PLAY NOW ➔
              </Button>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="nova-section-title"><h2>Why operators pick us</h2></div>
        <div className="nova-grid">
          {features.map((f) => (
            <Card key={f.title}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: "var(--nova-text-2)", margin: 0 }}>{f.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
