import { useEffect, useState } from "react";
import { Card, Table, Badge } from "@nova/ui";
import { api } from "../lib/api";

interface TxRow {
  id: string;
  method: string;
  status: string;
  currency: string;
  amount: string;
  fee: string;
  net: string;
  createdAt: string;
}

export function TransactionsPage({ token }: { token: string }): React.ReactElement {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: TxRow[] }>("/api/admin/transactions?page=1&pageSize=100", { accessToken: token })
      .then((r) => setRows(r.items))
      .catch((e) => setError((e as Error).message));
  }, [token]);

  return (
    <div>
      <div className="app-header">
        <h1 style={{ margin: 0 }}>Transactions</h1>
      </div>
      {error ? <Card><p style={{ color: "var(--nova-danger)" }}>{error}</p></Card> : null}
      <Table<TxRow>
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: "time", header: "Created", render: (r) => new Date(r.createdAt).toLocaleString() },
          { key: "method", header: "Method", render: (r) => <Badge tone="neutral">{r.method}</Badge> },
          { key: "status", header: "Status", render: (r) => (
            <Badge tone={r.status === "completed" ? "success" : r.status === "pending" ? "warning" : "danger"}>{r.status}</Badge>
          ) },
          { key: "currency", header: "Currency", render: (r) => r.currency },
          { key: "amount", header: "Amount", align: "right", render: (r) => r.amount },
          { key: "fee", header: "Fee", align: "right", render: (r) => r.fee },
          { key: "net", header: "Net", align: "right", render: (r) => r.net },
        ]}
      />
    </div>
  );
}
