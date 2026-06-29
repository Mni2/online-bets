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
  { slug: "dice-100", name: "Dice 100", tag: "Originals", desc: "Roll under or over. 1.5% house edge." },
  { slug: "crash-arcade", name: "Crash Arcade", tag: "Live", desc: "Cash out before the rocket leaves." },
  { slug: "roulette-eu", name: "European Roulette", tag: "Live", desc: "Single-zero wheel, classic bets." },
  { slug: "blackjack-az", name: "Blackjack AZ", tag: "Table", desc: "Six-deck shoe, late surrender." },
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
          <h2>Featured games</h2>
          <Link href="/lobby"><Button variant="ghost">All games</Button></Link>
        </div>
        <div className="nova-grid">
          {games.map((g) => (
            <Link key={g.slug} href={`/games/${g.slug}`} className="nova-game-card">
              <div className="nova-thumb" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{g.name}</strong>
                <Badge tone={g.tag === "Live" ? "primary" : "neutral"}>{g.tag}</Badge>
              </div>
              <span style={{ color: "var(--nova-text-2)", fontSize: 13 }}>{g.desc}</span>
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
