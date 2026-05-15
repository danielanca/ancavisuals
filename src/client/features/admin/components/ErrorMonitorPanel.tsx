import { useState, useEffect } from "react";
import { useErrorMonitor, type ErrorEntry } from "../providers/ErrorMonitorContext";
import useAuth from "../auth/useAuth";

const TYPE_CONFIG: Record<ErrorEntry["type"], { label: string; color: string }> = {
  client: { label: "JS",      color: "#f97316" },
  promise: { label: "Promise", color: "#a855f7" },
  console: { label: "Console", color: "#eab308" },
  server:  { label: "API",     color: "#ef4444" },
};

export default function ErrorMonitorPanel() {
  const { auth } = useAuth();
  const { errors, debugging, clearErrors } = useErrorMonitor();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!auth.authorise || !debugging) return null;

  const count = errors.length;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      left: 16,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 8,
    }}>
      {open && (
        <div style={{
          width: 360,
          maxHeight: 500,
          background: "#080808",
          border: "1px solid #1f1f1f",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        }}>
          <div style={{
            padding: "10px 14px",
            borderBottom: "1px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0d0d0d",
          }}>
            <span style={{ color: "#d4d4d4", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>
              Debug Monitor {count > 0 && <span style={{ color: "#ef4444" }}>({count})</span>}
            </span>
            <button
              onClick={clearErrors}
              style={{
                background: "none",
                border: "1px solid #222",
                borderRadius: 5,
                color: "#555",
                fontSize: 11,
                cursor: "pointer",
                padding: "2px 8px",
              }}
            >
              Golește
            </button>
          </div>

          <div style={{ overflowY: "auto", flex: 1, fontFamily: "monospace" }}>
            {errors.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#333", fontSize: 13 }}>
                Nicio eroare 🎉
              </div>
            ) : (
              errors.map(error => {
                const cfg = TYPE_CONFIG[error.type];
                const isExpanded = expanded === error.id;
                return (
                  <div
                    key={error.id}
                    onClick={() => setExpanded(isExpanded ? null : error.id)}
                    style={{
                      padding: "8px 14px",
                      borderBottom: "1px solid #111",
                      cursor: "pointer",
                      background: isExpanded ? "#0f0f0f" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: cfg.color,
                        background: `${cfg.color}22`,
                        borderRadius: 4,
                        padding: "1px 5px",
                        textTransform: "uppercase",
                      }}>
                        {cfg.label}
                      </span>
                      {error.status && (
                        <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>
                          {error.status}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: "#383838", marginLeft: "auto" }}>
                        {error.timestamp.toLocaleTimeString("ro-RO")}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: "#c4c4c4", wordBreak: "break-word", lineHeight: 1.5 }}>
                      {error.message}
                    </div>

                    {error.url && (
                      <div style={{ fontSize: 10, color: "#3f3f3f", wordBreak: "break-all", marginTop: 2 }}>
                        {error.url}
                      </div>
                    )}

                    {isExpanded && error.detail && (
                      <pre style={{
                        fontSize: 10,
                        color: "#484848",
                        margin: "6px 0 0",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        maxHeight: 120,
                        overflow: "auto",
                        background: "#0a0a0a",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #1a1a1a",
                      }}>
                        {error.detail}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(open => !open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 11px",
          background: "#080808",
          border: `1px solid ${count > 0 ? "#7f1d1d" : "#1f1f1f"}`,
          borderRadius: 8,
          color: count > 0 ? "#ef4444" : "#444",
          fontSize: 13,
          cursor: "pointer",
          boxShadow: count > 0 ? "0 0 10px rgba(239,68,68,0.2)" : "0 2px 8px rgba(0,0,0,0.5)",
          transition: "all 0.2s",
        }}
        title="Debug Monitor"
      >
        🪲
        {count > 0 && (
          <span style={{
            background: "#ef4444",
            color: "#fff",
            borderRadius: 999,
            padding: "0 5px",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: "16px",
          }}>
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
