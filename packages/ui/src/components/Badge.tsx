import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}

const tones: Record<NonNullable<BadgeProps["tone"]>, React.CSSProperties> = {
  neutral: { background: "var(--nova-surface-2)", color: "var(--nova-text-1)" },
  primary: { background: "rgba(124, 92, 255, 0.18)", color: "var(--nova-primary)" },
  success: { background: "rgba(43, 217, 123, 0.18)", color: "var(--nova-success)" },
  warning: { background: "rgba(255, 181, 71, 0.18)", color: "var(--nova-warning)" },
  danger: { background: "rgba(255, 93, 122, 0.18)", color: "var(--nova-danger)" },
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ tone = "neutral", style, children, ...rest }, ref) => (
    <span
      ref={ref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "var(--nova-radius-pill)",
        fontSize: 12,
        fontWeight: 600,
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  )
);
Badge.displayName = "Badge";
