"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, Table } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";

interface BetRow {
  id: string;
  amount: string;
  payout: string;
  profit: string;
  multiplier: string;
  status: string;
  placedAt: string;
  settledAt: string | null;
  result: { roll?: number; won?: boolean } | null;
}

export default function HistoryPage(): React.ReactElement {
  const [bets, setBets] = useState<BetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const access = tokenStore.get().access;

  useEffect(() => {
    if (!access) return;
    api<BetRow[]>("/api/games/bets/me", { accessToken: access })
      .then(setBets)
      .catch((e) => setError((e as Error).message));
  }, [access]);

  if (!access) {
    return <Card><p>Please <Link href="/login" style={{ color: "var(--nova-primary)" }}>sign in</Link> to view your history.</p></Card>;
  }

  return (
    <div>
      <div className="nova-section-title">
        <h2>Bet history</h2>
        <Badge tone="primary">{bets.length} bets</Badge>
      </div>
      {error ? <Card><p style={{ color: "var(--nova-danger)" }}>{error}</p></Card> : null}
      <Table<BetRow>
        rows={bets}
        rowKey={(r) => r.id}
        columns={[
          { key: "time", header: "Placed", render: (r) => new Date(r.placedAt).toLocaleString() },
          { key: "amount", header: "Amount", align: "right", render: (r) => r.amount },
          { key: "multiplier", header: "Multiplier", align: "right", render: (r) => r.multiplier },
          { key: "payout", header: "Payout", align: "right", render: (r) => r.payout },
          { key: "profit", header: "Profit", align: "right", render: (r) => (
            <span style={{ color: Number(r.profit) >= 0 ? "var(--nova-success)" : "var(--nova-danger)" }}>{r.profit}</span>
          ) },
          { key: "status", header: "Status", render: (r) => (
            <Badge tone={r.status === "won" ? "success" : r.status === "lost" ? "danger" : "neutral"}>{r.status}</Badge>
          ) },
          { key: "roll", header: "Roll", align: "right", render: (r) => r.result?.roll?.toFixed?.(2) ?? "—" },
        ]}
      />
    </div>
  );
}
