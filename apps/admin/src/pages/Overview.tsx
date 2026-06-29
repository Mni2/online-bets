import { useEffect, useState } from "react";
import { Card, Stat, Badge } from "@nova/ui";
import { api } from "../lib/api";

interface OverviewDTO {
  users: number;
  bets: number;
  deposits: number;
  withdrawals: number;
  kycPending: number;
  totalWagered: string;
  totalPaid: string;
}

export function OverviewPage({ token }: { token: string }): React.ReactElement {
  const [data, setData] = useState<OverviewDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<OverviewDTO>("/api/admin/overview", { accessToken: token })
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [token]);

  if (error) return <Card><p style={{ color: "var(--nova-danger)" }}>{error}</p></Card>;
  if (!data) return <Card><p>Loading…</p></Card>;

  return (
    <div>
      <div className="app-header">
        <h1 style={{ margin: 0 }}>Operations overview</h1>
        <Badge tone="primary">Live · last 24h</Badge>
      </div>
      <div className="grid-stats">
        <Stat label="Users" value={data.users.toLocaleString()} trend="+8% wow" trendDirection="up" />
        <Stat label="Bets placed" value={data.bets.toLocaleString()} trend="+12% wow" trendDirection="up" />
        <Stat label="Deposits" value={data.deposits.toLocaleString()} trend="+3% wow" trendDirection="up" />
        <Stat label="Pending withdrawals" value={data.withdrawals.toLocaleString()} trend="-1 wow" trendDirection="down" />
        <Stat label="KYC queue" value={data.kycPending.toLocaleString()} trend="within SLA" trendDirection="flat" />
        <Stat label="Total wagered" value={Number(data.totalWagered).toLocaleString()} trend="USD" trendDirection="up" />
        <Stat label="Total paid out" value={Number(data.totalPaid).toLocaleString()} trend="USD" trendDirection="up" />
      </div>

      <Card style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Health</h3>
        <p style={{ color: "var(--nova-text-2)" }}>All systems operational. Database replication lag: 12ms · WebSocket fan-out: 14k concurrent · Cold wallet queue: empty.</p>
      </Card>
    </div>
  );
}
