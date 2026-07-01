"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Button, Badge } from "@nova/ui";
import { api, tokenStore } from "@/lib/api";

type RegisterStep = "register" | "verify_email";

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<RegisterStep>("register");
  const [userId, setUserId] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [devEmailOtpCode, setDevEmailOtpCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const r = await api<
        | { accessToken: string; refreshToken: string }
        | { status: "email_verification_required"; userId: string; devEmailOtpCode?: string }
      >("/api/auth/register", {
        method: "POST",
        body: form,
      });

      if ("status" in r) {
        setUserId(r.userId);
        if (r.devEmailOtpCode) setDevEmailOtpCode(r.devEmailOtpCode);
        setStep("verify_email");
      } else {
        tokenStore.set(r.accessToken, r.refreshToken);
        router.push("/lobby");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const r = await api<{ accessToken: string; refreshToken: string }>(
        "/api/auth/register/verify-email",
        { method: "POST", body: { userId, code: emailCode } }
      );
      tokenStore.set(r.accessToken, r.refreshToken);
      router.push("/lobby");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const r = await api<{ status: string; userId: string; devEmailOtpCode?: string }>(
        "/api/auth/register/resend-email-otp",
        { method: "POST", body: { userId } }
      );
      if (r.devEmailOtpCode) setDevEmailOtpCode(r.devEmailOtpCode);
      setEmailCode("");
      setSuccessMessage("A new verification code has been generated!");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "verify_email") {
    return (
      <div className="nova-auth-wrap">
        <Card padded glow className="nova-auth-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h1 style={{ margin: 0 }}>Verify email</h1>
            <Badge tone="primary">Verification</Badge>
          </div>
          <p style={{ color: "var(--nova-text-2)", marginTop: 0 }}>
            Enter the 6-digit confirmation code sent to <strong>{form.email}</strong>.
          </p>

          {devEmailOtpCode ? (
            <div style={{ background: "rgba(124, 92, 255, 0.12)", border: "1px solid var(--nova-primary)", borderRadius: 8, padding: 12, textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--nova-text-2)", marginBottom: 4, fontWeight: 600 }}>DEMO VERIFICATION CODE</div>
              <div style={{ fontSize: 24, letterSpacing: 4, fontFamily: "monospace", color: "var(--nova-primary)", fontWeight: "bold" }}>{devEmailOtpCode}</div>
            </div>
          ) : null}

          {successMessage ? (
            <div className="nova-banner" style={{ background: "rgba(43, 217, 123, 0.1)", borderColor: "rgba(43, 217, 123, 0.3)", color: "var(--nova-success)", marginBottom: 12, textAlign: "center", fontWeight: 600 }}>
              {successMessage}
            </div>
          ) : null}

          <form onSubmit={handleVerifyEmail} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label="6-Digit Verification Code"
              required
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
            />
            {error ? (
              <div className="nova-banner" style={{ background: "rgba(255, 93, 122, 0.1)", borderColor: "rgba(255, 93, 122, 0.3)", color: "var(--nova-danger)" }}>{error}</div>
            ) : null}
            <Button type="submit" block loading={loading}>Verify & Log In</Button>
          </form>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--nova-primary)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "underline",
                opacity: loading ? 0.6 : 1
              }}
            >
              Resend verification code
            </button>
          </div>
        </Card>
      </div>
    );
  }

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
