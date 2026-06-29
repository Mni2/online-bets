import * as React from "react";

export interface StatProps {
  label: string;
  value: string;
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
}

export const Stat: React.FC<StatProps> = ({ label, value, trend, trendDirection = "flat" }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
      padding: 16,
      borderRadius: "var(--nova-radius-lg)",
      background: "var(--nova-surface)",
      border: "1px solid var(--nova-border)",
    }}
  >
    <span
      style={{
        color: "var(--nova-text-3)",
        fontSize: 12,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
    <span style={{ color: "var(--nova-text-0)", fontSize: 24, fontWeight: 700 }}>{value}</span>
    {trend ? (
      <span
        style={{
          fontSize: 12,
          color:
            trendDirection === "up"
              ? "var(--nova-success)"
              : trendDirection === "down"
              ? "var(--nova-danger)"
              : "var(--nova-text-2)",
        }}
      >
        {trendDirection === "up" ? "?" : trendDirection === "down" ? "?" : "—"} {trend}
      </span>
    ) : null}
  </div>
);
