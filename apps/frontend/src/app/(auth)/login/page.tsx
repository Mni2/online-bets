"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Button, Badge } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
        method: "POST",
        body: { identifier, password },
      });
      tokenStore.set(result.accessToken, result.refreshToken);
      router.push("/lobby");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nova-auth-wrap">
      <Card padded glow className="nova-auth-card">
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>Welcome back</h1>
          <Badge tone="primary">Nova Royale</Badge>
        </div>
        <p style={{ color: "var(--nova-text-2)", marginTop: 0 }}>
          New here? <Link href="/register" style={{ color: "var(--nova-primary)" }}>Create an account</Link>.
        </p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label="Email or username"
            value={identifier}
            autoComplete="username"
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <div className="nova-banner" style={{ background: "rgba(255, 93, 122, 0.1)", borderColor: "rgba(255, 93, 122, 0.3)", color: "var(--nova-danger)" }}>{error}</div> : null}
          <Button type="submit" block loading={loading}>Sign in</Button>
        </form>
      </Card>
    </div>
  );
}
