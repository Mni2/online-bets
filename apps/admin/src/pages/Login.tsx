import { useState, useEffect } from "react";
import { Card, Input, Button } from "@nova/ui";
import { api } from "../lib/api";

type MfaStep = "password" | "totp_setup" | "totp";

export function LoginPage({ onAuthed }: { onAuthed: (token: string) => void }): React.ReactElement {
  const [identifier, setIdentifier] = useState("novaroyalhelp@gmail.com");
  const [password, setPassword] = useState("ChangeMe!2026");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 2FA state
  const [mfaStep, setMfaStep] = useState<MfaStep>("password");
  const [userId, setUserId] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  // Load Google Identity Services SDK script dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Initialize and render the Google Sign-in button when Google GSI is ready
  useEffect(() => {
    if (mfaStep !== "password") return;

    const interval = setInterval(() => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        clearInterval(interval);
        
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "683515822394-aefc6o0guk3iur44tflomadag3l7g7f7.apps.googleusercontent.com";
        
        g.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
        });

        const btnContainer = document.getElementById("google-signin-btn");
        if (btnContainer) {
          g.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: btnContainer.clientWidth || 388,
          });
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [mfaStep]);

  const handleGoogleCredentialResponse = async (response: any) => {
    setError(null);
    setBusy(true);
    try {
      const r = await api<
        | { accessToken: string }
        | { status: "mfa_setup"; userId: string; totpSecret: string; totpUri: string }
        | { status: "mfa_totp_required"; userId: string }
      >("/api/auth/google-login", {
        method: "POST",
        body: { credential: response.credential },
      });

      if ("status" in r) {
        setUserId(r.userId);
        if (r.status === "mfa_setup") {
          setTotpSecret(r.totpSecret);
          setTotpUri(r.totpUri);
          setMfaStep("totp_setup");
        } else if (r.status === "mfa_totp_required") {
          setMfaStep("totp");
        }
      } else {
        onAuthed(r.accessToken);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await api<
        | { accessToken: string }
        | { status: "mfa_setup"; userId: string; totpSecret: string; totpUri: string }
        | { status: "mfa_totp_required"; userId: string }
      >("/api/auth/login", { method: "POST", body: { identifier, password } });

      if ("status" in r) {
        setUserId(r.userId);
        if (r.status === "mfa_setup") {
          setTotpSecret(r.totpSecret);
          setTotpUri(r.totpUri);
          setMfaStep("totp_setup");
        } else if (r.status === "mfa_totp_required") {
          setMfaStep("totp");
        }
      } else {
        onAuthed(r.accessToken);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  };

  if (mfaStep === "totp_setup") {
    const handleSetup = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null); setBusy(true);
      try {
        const r = await api<{ accessToken: string }>(
          "/api/auth/mfa/setup-totp",
          { method: "POST", body: { userId, token: totpCode } }
        );
        onAuthed(r.accessToken);
      } catch (err) {
        setError((err as Error).message);
      } finally { setBusy(false); }
    };

    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
        <Card padded glow style={{ width: "100%", maxWidth: 420 }}>
          <h1 style={{ marginTop: 0 }}>2FA Step 2: Authenticator</h1>
          <p style={{ color: "var(--nova-text-2)" }}>Scan this key in Google Authenticator or enter it manually to set up 2FA.</p>
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--nova-border)", padding: 16, borderRadius: 8, textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--nova-text-2)", marginBottom: 4 }}>SECURITY KEY</div>
            <div style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: 1, color: "var(--nova-primary)", fontWeight: "bold" }}>{totpSecret}</div>
          </div>
          <form onSubmit={handleSetup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="6-Digit Verification Code" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} required />
            {error ? <p style={{ color: "var(--nova-danger)" }}>{error}</p> : null}
            <Button type="submit" block loading={busy}>Confirm & Log In</Button>
          </form>
        </Card>
      </div>
    );
  }

  if (mfaStep === "totp") {
    const handleVerifyTotp = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null); setBusy(true);
      try {
        const r = await api<{ accessToken: string }>(
          "/api/auth/mfa/verify-totp",
          { method: "POST", body: { userId, token: totpCode } }
        );
        onAuthed(r.accessToken);
      } catch (err) {
        setError((err as Error).message);
      } finally { setBusy(false); }
    };

    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
        <Card padded glow style={{ width: "100%", maxWidth: 420 }}>
          <h1 style={{ marginTop: 0 }}>2FA Step 2: Authenticator</h1>
          <p style={{ color: "var(--nova-text-2)" }}>Enter the 6-digit security code generated by your Authenticator app.</p>
          <form onSubmit={handleVerifyTotp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="6-Digit TOTP Code" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} required />
            {error ? <p style={{ color: "var(--nova-danger)" }}>{error}</p> : null}
            <Button type="submit" block loading={busy}>Verify & Log In</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card padded glow style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ marginTop: 0 }}>Admin sign-in (2FA)</h1>
        <p style={{ color: "var(--nova-text-2)" }}>Two-Factor Authentication is enabled for all operators. Please enter your email and password.</p>
        
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p style={{ color: "var(--nova-danger)" }}>{error}</p> : null}
          <Button type="submit" block loading={busy}>Sign in</Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", margin: "16px 0", color: "var(--nova-text-2)", fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--nova-border)" }}></div>
          <span style={{ padding: "0 8px" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "var(--nova-border)" }}></div>
        </div>

        {/* Google Identity Sign-in button container */}
        <div id="google-signin-btn" style={{ display: "flex", justifyContent: "center" }}></div>
      </Card>
    </div>
  );
}
