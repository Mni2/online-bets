import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  errorText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, errorText, style, id, ...rest }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <label
        htmlFor={inputId}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 13,
          color: "var(--nova-text-1)",
          fontFamily: "var(--nova-font-sans)",
        }}
      >
        {label ? <span style={{ fontWeight: 600 }}>{label}</span> : null}
        <input
          id={inputId}
          ref={ref}
          style={{
            background: "var(--nova-bg-2)",
            color: "var(--nova-text-0)",
            border: `1px solid ${errorText ? "var(--nova-danger)" : "var(--nova-border-strong)"}`,
            borderRadius: "var(--nova-radius-md)",
            padding: "10px 12px",
            fontSize: 14,
            outline: "none",
            fontFamily: "var(--nova-font-sans)",
            ...style,
          }}
          {...rest}
        />
        {hint && !errorText ? (
          <span style={{ color: "var(--nova-text-3)", fontSize: 12 }}>{hint}</span>
        ) : null}
        {errorText ? (
          <span style={{ color: "var(--nova-danger)", fontSize: 12 }}>{errorText}</span>
        ) : null}
      </label>
    );
  }
);
Input.displayName = "Input";
