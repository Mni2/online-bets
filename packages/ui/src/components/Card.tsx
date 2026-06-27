import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  glow?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ padded = true, glow = false, style, children, ...rest }, ref) => (
    <div
      ref={ref}
      style={{
        background: "var(--nova-surface)",
        border: "1px solid var(--nova-border)",
        borderRadius: "var(--nova-radius-lg)",
        padding: padded ? 20 : 0,
        boxShadow: glow
          ? "0 12px 40px rgba(124, 92, 255, 0.18)"
          : "0 6px 24px rgba(0,0,0,0.32)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";
