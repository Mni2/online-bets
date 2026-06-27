import * as React from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  empty?: React.ReactNode;
  rowKey: (row: T) => string;
}

export function Table<T>({ columns, rows, empty, rowKey }: TableProps<T>): React.ReactElement {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--nova-text-3)",
          background: "var(--nova-surface)",
          border: "1px dashed var(--nova-border)",
          borderRadius: "var(--nova-radius-lg)",
        }}
      >
        {empty ?? "No records."}
      </div>
    );
  }
  return (
    <div
      style={{
        overflow: "auto",
        background: "var(--nova-surface)",
        border: "1px solid var(--nova-border)",
        borderRadius: "var(--nova-radius-lg)",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--nova-font-sans)",
        }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align ?? "left",
                  padding: "12px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: "var(--nova-text-3)",
                  borderBottom: "1px solid var(--nova-border)",
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} style={{ borderBottom: "1px solid var(--nova-border)" }}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "var(--nova-text-0)",
                    textAlign: c.align ?? "left",
                  }}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
