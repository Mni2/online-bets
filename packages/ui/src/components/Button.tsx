import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: "var(--nova-radius-md)",
  border: "1px solid transparent",
  fontWeight: 600,
  fontFamily: "var(--nova-font-sans)",
  cursor: "pointer",
  transition: "transform 80ms ease, background 120ms ease, border-color 120ms",
  userSelect: "none",
};

const sizeStyle: Record<Size, React.CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 13, minHeight: 32 },
  md: { padding: "9px 16px", fontSize: 14, minHeight: 40 },
  lg: { padding: "12px 20px", fontSize: 16, minHeight: 48 },
};

const variantStyle: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, var(--nova-primary), var(--nova-primary-700))",
    color: "white",
    boxShadow: "0 8px 20px rgba(124, 92, 255, 0.35)",
  },
  secondary: {
    background: "var(--nova-surface-2)",
    color: "var(--nova-text-0)",
    border: "1px solid var(--nova-border-strong)",
  },
  ghost: {
    background: "transparent",
    color: "var(--nova-text-1)",
    border: "1px solid var(--nova-border)",
  },
  danger: { background: "var(--nova-danger)", color: "white" },
  success: { background: "var(--nova-success)", color: "#08210f" },
};

const Spinner = () => (
  <span
    aria-hidden
    style={{
      width: 14,
      height: 14,
      border: "2px solid currentColor",
      borderRightColor: "transparent",
      borderRadius: "50%",
      display: "inline-block",
      animation: "nova-spin 0.7s linear infinite",
    }}
  />
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, block, disabled, style, children, ...rest },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={{
        ...baseStyle,
        ...sizeStyle[size],
        ...variantStyle[variant],
        width: block ? "100%" : undefined,
        opacity: disabled || loading ? 0.55 : 1,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        ...style,
      }}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
);
Button.displayName = "Button";
