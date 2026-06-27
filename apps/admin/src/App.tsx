import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { BRAND } from "@nova/shared";
import { OverviewPage } from "./pages/Overview";
import { UsersPage } from "./pages/Users";
import { TransactionsPage } from "./pages/Transactions";
import { KycPage } from "./pages/Kyc";
import { LoginPage } from "./pages/Login";
import { adminStore, api } from "./lib/api";

export function App(): React.ReactElement {
  const [auth, setAuth] = useState<string | null>(adminStore.get().access);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth) return;
    api("/api/admin/overview", { accessToken: auth }).catch(() => {
      adminStore.clear();
      setAuth(null);
      navigate("/login");
    });
  }, [auth, navigate]);

  if (!auth) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onAuthed={(t) => { adminStore.set(t); setAuth(t); navigate("/"); }} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div style={{ fontWeight: 700, padding: "8px 12px 16px" }}>{BRAND.name} · Admin</div>
        <NavLink to="/" end>Overview</NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/transactions">Transactions</NavLink>
        <NavLink to="/kyc">KYC queue</NavLink>
        <div style={{ marginTop: "auto" }}>
          <button
            onClick={() => { adminStore.clear(); setAuth(null); navigate("/login"); }}
            style={{
              background: "transparent", color: "var(--nova-text-1)", border: "1px solid var(--nova-border)",
              borderRadius: "var(--nova-radius-md)", padding: "8px 12px", cursor: "pointer", width: "100%", textAlign: "left",
            }}
          >Sign out</button>
        </div>
      </aside>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<OverviewPage token={auth} />} />
          <Route path="/users" element={<UsersPage token={auth} />} />
          <Route path="/transactions" element={<TransactionsPage token={auth} />} />
          <Route path="/kyc" element={<KycPage token={auth} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
