import { BRAND } from "@nova/shared";

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="nova-footer">
      <div>(c) {new Date().getFullYear()} {BRAND.name}. For demo purposes only - play responsibly.</div>
      <div style={{ marginTop: 6, opacity: 0.7 }}>
        18+ - KYC required - Provably fair - BeGambleAware.org - GamCare.org.uk
      </div>
    </footer>
  );
}