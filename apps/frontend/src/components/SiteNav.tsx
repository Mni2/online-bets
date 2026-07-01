"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@nova/shared";

const links = [
  { href: "/", label: "Home" },
  { href: "/lobby", label: "Lobby" },
  { href: "/games/live", label: "Live Casino" },
  { href: "/games/sports", label: "Sportsbook" },
  { href: "/games/aggregator", label: "Aggregator" },
  { href: "/wallet", label: "Wallet" },
  { href: "/history", label: "History" },
];

export function SiteNav(): React.ReactElement {
  const path = usePathname() ?? "/";
  return (
    <header className="nova-nav">
      <Link href="/" className="nova-nav-brand">
        <span style={{
          display: "inline-block", width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, var(--nova-primary), var(--nova-accent))",
        }} />
        <span>{BRAND.name}</span>
      </Link>
      <nav className="nova-nav-links" aria-label="Primary">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="nova-nav-link"
            data-active={path === l.href || (l.href !== "/" && path.startsWith(l.href))}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div style={{ display: "flex", gap: 8 }}>
        <Link href="/login" className="nova-nav-link">Log in</Link>
        <Link href="/register" className="nova-nav-link" style={{
          background: "var(--nova-primary)", color: "white", fontWeight: 600,
        }}>Sign up</Link>
      </div>
    </header>
  );
}
