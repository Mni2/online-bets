import "@nova/ui/tokens.css";
import "./globals.css";
import "../styles/nav.css";
import type { Metadata, Viewport } from "next";
import { BRAND } from "@nova/shared";
import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  themeColor: "#0a0d1a",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0d1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <div className="nova-shell">
          <SiteNav />
          <main className="nova-main">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
