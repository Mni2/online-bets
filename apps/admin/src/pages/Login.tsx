import { useState } from "react";
import { Card, Input, Button } from "@nova/ui";
import { api } from "../lib/api";

export function LoginPage({ onAuthed }: { onAuthed: (token: string) => void }): React.ReactElement {
  const [identifier, setIdentifier] = useState("admin@novaroyale.example");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await api<{ accessToken: string }>("/api/auth/login", { method: "POST", body: { identifier, password } });
      onAuthed(r.accessToken);
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card padded glow style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ marginTop: 0 }}>Admin sign-in</h1>
        <p style={{ color: "var(--nova-text-2)" }}>Use your superadmin credentials. SSO is available for enterprise tenants.</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p style={{ color: "var(--nova-danger)" }}>{error}</p> : null}
          <Button type="submit" block loading={busy}>Sign in</Button>
        </form>
      </Card>
    </div>
  );
}
