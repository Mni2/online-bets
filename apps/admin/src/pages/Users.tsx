import { useEffect, useState } from "react";
import { Card, Input, Table, Badge } from "@nova/ui";
import { api } from "../lib/api";

interface UserRow {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  kycStatus: string;
  createdAt: string;
  balances: { currency: string; balance: string; locked: string }[];
}

export function UsersPage({ token }: { token: string }): React.ReactElement {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}&page=1&pageSize=50`, { accessToken: token })
      .then((r) => setRows(r.items))
      .catch((e) => setError((e as Error).message));
  }, [q, token]);

  return (
    <div>
      <div className="app-header">
        <h1 style={{ margin: 0 }}>Users</h1>
        <Input placeholder="Search email, username, display name…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? <Card><p style={{ color: "var(--nova-danger)" }}>{error}</p></Card> : null}
      <Table<UserRow>
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: "user", header: "User", render: (r) => (
            <div>
              <div style={{ fontWeight: 600 }}>{r.displayName} <span className="muted">@{r.username}</span></div>
              <div className="muted" style={{ fontSize: 12 }}>{r.email}</div>
            </div>
          ) },
          { key: "role", header: "Role", render: (r) => <Badge tone={r.role === "player" ? "neutral" : "primary"}>{r.role}</Badge> },
          { key: "kyc", header: "KYC", render: (r) => (
            <Badge tone={r.kycStatus === "approved" ? "success" : r.kycStatus === "pending" ? "warning" : r.kycStatus === "rejected" ? "danger" : "neutral"}>{r.kycStatus}</Badge>
          ) },
          { key: "balances", header: "Balances", render: (r) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {r.balances.map((b) => (
                <span key={b.currency} style={{ fontFamily: "var(--nova-font-mono)" }}>{b.currency} {Number(b.balance).toFixed(2)}</span>
              ))}
              {r.balances.length === 0 ? <span className="muted">—</span> : null}
            </div>
          ) },
          { key: "created", header: "Joined", render: (r) => new Date(r.createdAt).toLocaleDateString() },
        ]}
      />
    </div>
  );
}
