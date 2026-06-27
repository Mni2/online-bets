"use client";
import { useEffect, useState } from "react";
import { Card, Button, Input, Badge, Stat } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";

interface WalletDTO {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  locked: string;
  bonusBalance: string;
}

interface LedgerRow {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  referenceType: string | null;
  createdAt: string;
}

export default function WalletPage(): React.ReactElement {
  const [wallets, setWallets] = useState<WalletDTO[]>([]);
  const [history, setHistory] = useState<LedgerRow[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const access = tokenStore.get().access;

  const load = async (): Promise<void> => {
    if (!access) return;
    try {
      const w = await api<WalletDTO[]>("/api/wallet", { accessToken: access });
      setWallets(w);
      const h = await api<{ items: LedgerRow[] }>("/api/wallet/history?page=1&pageSize=20", { accessToken: access });
      setHistory(h.items);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensure = async (): Promise<void> => {
    setBusy(true); setError(null);
    try {
      await api("/api/wallet/ensure", { method: "POST", body: { currency }, accessToken: access ?? "" });
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const deposit = async (): Promise<void> => {
    setBusy(true); setError(null); setInfo(null);
    try {
      await api("/api/wallet/deposit", { method: "POST", body: { currency, amount, method: "manual" }, accessToken: access ?? "" });
      setInfo(`Deposit of ${amount} ${currency} queued.`);
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const withdraw = async (): Promise<void> => {
    setBusy(true); setError(null); setInfo(null);
    try {
      await api("/api/wallet/withdraw", { method: "POST", body: { currency, amount, destination: "demo-address" }, accessToken: access ?? "" });
      setInfo(`Withdrawal of ${amount} ${currency} submitted.`);
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const totals = wallets.reduce<Record<string, { balance: number; locked: number; bonus: number }>>((acc, w) => {
    acc[w.currency] = {
      balance: Number(w.balance),
      locked: Number(w.locked),
      bonus: Number(w.bonusBalance),
    };
    return acc;
  }, {});

  return (
    <div>
      <div className="nova-section-title">
        <h2>Wallet</h2>
        <Badge tone="primary">Demo mode</Badge>
      </div>

      {!access ? (
        <Card><p>Please <a style={{ color: "var(--nova-primary)" }} href="/login">sign in</a> to access your wallet.</p></Card>
      ) : (
        <>
          <div className="nova-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {Object.entries(totals).map(([cur, t]) => (
              <Stat key={cur} label={`${cur} Balance`} value={t.balance.toFixed(2)} trend={`Locked ${t.locked.toFixed(2)}`} trendDirection="flat" />
            ))}
            {Object.keys(totals).length === 0 ? (
              <Card><p>No wallets yet. Create one below to start playing.</p></Card>
            ) : null}
          </div>

          <div className="nova-row" style={{ marginTop: 16 }}>
            <Card>
              <h3 style={{ marginTop: 0 }}>Add funds (demo)</h3>
              <p style={{ color: "var(--nova-text-2)" }}>Manually credited to your account for testing. In production this is replaced by Stripe / Coinbase / SEPA flows.</p>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                <Input label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                  <Button onClick={ensure} variant="secondary" loading={busy}>Ensure wallet</Button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Button onClick={deposit} loading={busy}>Deposit</Button>
                <Button onClick={withdraw} variant="secondary" loading={busy}>Withdraw</Button>
              </div>
              {error ? <p style={{ color: "var(--nova-danger)", marginTop: 12 }}>{error}</p> : null}
              {info ? <p style={{ color: "var(--nova-success)", marginTop: 12 }}>{info}</p> : null}
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Recent ledger</h3>
              {history.length === 0 ? (
                <p style={{ color: "var(--nova-text-3)" }}>No transactions yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.map((row) => (
                    <div key={row.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--nova-border)", padding: "8px 0" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{row.type}</div>
                        <div style={{ color: "var(--nova-text-3)", fontSize: 12 }}>{new Date(row.createdAt).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--nova-font-mono)" }}>{row.amount}</div>
                        <div style={{ color: "var(--nova-text-3)", fontSize: 12 }}>after {row.balanceAfter}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
