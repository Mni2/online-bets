"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Button, Badge } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    username: "",
    displayName: "",
    password: "",
    acceptTos: false,
    acceptAge: false,
    referralCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (!form.acceptTos || !form.acceptAge) {
      setError("You must confirm age and accept the terms.");
      return;
    }
    setLoading(true);
    try {
      const result = await api<{ accessToken: string; refreshToken: string }>("/api/auth/register", {
        method: "POST",
        body: form,
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>Create account</h1>
          <Badge tone="warning">18+</Badge>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
          <Input label="Username" required value={form.username} onChange={(e) => update("username", e.target.value)} />
          <Input label="Display name" required value={form.displayName} onChange={(e) => update("displayName", e.target.value)} />
          <Input
            label="Password"
            type="password"
            required
            hint="Min 8 chars with 3 of: lower, upper, number, symbol"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <Input
            label="Referral code (optional)"
            value={form.referralCode}
            onChange={(e) => update("referralCode", e.target.value)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--nova-text-1)", fontSize: 13 }}>
            <input type="checkbox" checked={form.acceptAge} onChange={(e) => update("acceptAge", e.target.checked)} /> I am 18 or older (or legal age in my jurisdiction).
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--nova-text-1)", fontSize: 13 }}>
            <input type="checkbox" checked={form.acceptTos} onChange={(e) => update("acceptTos", e.target.checked)} /> I accept the Terms, AML/KYC policy, and responsible gaming rules.
          </label>
          {error ? (
            <div className="nova-banner" style={{ background: "rgba(255, 93, 122, 0.1)", borderColor: "rgba(255, 93, 122, 0.3)", color: "var(--nova-danger)" }}>{error}</div>
          ) : null}
          <Button type="submit" block loading={loading}>Create account</Button>
        </form>
        <p style={{ marginTop: 16, color: "var(--nova-text-2)" }}>
          Already a member? <Link href="/login" style={{ color: "var(--nova-primary)" }}>Sign in</Link>.
        </p>
      </Card>
    </div>
  );
}
