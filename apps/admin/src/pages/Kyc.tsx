import { useEffect, useState } from "react";
import { Card, Table, Badge, Button } from "@nova/ui";
import { api } from "../lib/api";

interface KycRow {
  id: string;
  user: { id: string; email: string; username: string };
  type: string;
  storageKey: string;
  createdAt: string;
}

export function KycPage({ token }: { token: string }): React.ReactElement {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      const r = await api<KycRow[]>("/api/admin/kyc", { accessToken: token });
      setRows(r);
    } catch (e) { setError((e as Error).message); }
  };

  useEffect(() => { void load(); }, [token]);

  const decide = async (id: string, decision: "approved" | "rejected"): Promise<void> => {
    try {
      await api(`/api/admin/kyc/${id}/review`, { method: "POST", body: { decision }, accessToken: token });
      await load();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <div>
      <div className="app-header">
        <h1 style={{ margin: 0 }}>KYC queue</h1>
        <Badge tone="warning">{rows.length} pending</Badge>
      </div>
      {error ? <Card><p style={{ color: "var(--nova-danger)" }}>{error}</p></Card> : null}
      <Table<KycRow>
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: "user", header: "User", render: (r) => (
            <div>
              <div style={{ fontWeight: 600 }}>@{r.user.username}</div>
              <div className="muted" style={{ fontSize: 12 }}>{r.user.email}</div>
            </div>
          ) },
          { key: "type", header: "Document", render: (r) => <Badge tone="neutral">{r.type}</Badge> },
          { key: "file", header: "File", render: (r) => <code style={{ fontSize: 12 }}>{r.storageKey}</code> },
          { key: "created", header: "Submitted", render: (r) => new Date(r.createdAt).toLocaleString() },
          { key: "actions", header: "Decide", align: "right", render: (r) => (
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <Button size="sm" variant="success" onClick={() => decide(r.id, "approved")}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => decide(r.id, "rejected")}>Reject</Button>
            </div>
          ) },
        ]}
      />
    </div>
  );
}
