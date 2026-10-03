import { useState, useEffect, useRef } from "react";
import { useErrorMonitor, type ErrorEntry } from "../providers/ErrorMonitorContext";
import useAuth from "../auth/useAuth";

const TYPE_CONFIG: Record<ErrorEntry["type"], { label: string; color: string }> = {
  client:  { label: "JS",      color: "#f97316" },
  promise: { label: "Promise", color: "#a855f7" },
  console: { label: "Console", color: "#eab308" },
  server:  { label: "API",     color: "#ef4444" },
};

export default function ClientDebugBadge() {
  const { errors, clearErrors } = useErrorMonitor();
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevCountRef = useRef(0);

  const count = errors.length;

  useEffect(() => {
    if (count > prevCountRef.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 800);
      prevCountRef.current = count;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = count;
  }, [count]);

  useEffect(() => {
    if (count === 0) setOpen(false);
  }, [count]);

  if (auth.loading || !auth.authorise || count === 0) return null;

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9996, background: "rgba(0,0,0,0.45)" }}
        />
      )}

      <div style={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 9997,
        display: "flex",
        alignItems: "stretch",
        flexDirection: "row",
      }}>
        {open && (
          <div style={{
            width: 300,
            maxHeight: 460,
            background: "#0a0a0a",
            border: "1px solid #1f1f1f",
            borderRight: "none",
            borderRadius: "12px 0 0 12px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "-8px 0 32px rgba(0,0,0,0.7)",
          }}>
            <AdminPanel errors={errors} onClear={clearErrors} onClose={() => setOpen(false)} />
          </div>
        )}

        <button
          onClick={() => setOpen(prev => !prev)}
          title="Erori detectate"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            padding: "14px 9px",
            background: "#dc2626",
            border: "none",
            borderRadius: open ? "0 8px 8px 0" : "8px 0 0 8px",
            color: "#fff",
            cursor: "pointer",
            boxShadow: pulse
              ? "0 0 22px rgba(220,38,38,0.9), -4px 0 16px rgba(220,38,38,0.5)"
              : "-4px 0 18px rgba(220,38,38,0.35)",
            transition: "box-shadow 0.3s, transform 0.15s",
            transform: pulse ? "translateX(-3px)" : "translateX(0)",
            minWidth: 34,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{
            background: "#fff",
            color: "#dc2626",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            minWidth: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
          }}>
            {count > 9 ? "9+" : count}
          </span>
        </button>
      </div>
    </>
  );
}

function AdminPanel({
  errors,
  onClear,
  onClose,
}: {
  errors: ErrorEntry[];
  onClear: () => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyAll = () => {
    const text = errors.map((error, index) => {
      const cfg = TYPE_CONFIG[error.type];
      const lines = [
        `[${index + 1}] ${cfg.label.toUpperCase()} — ${error.timestamp.toLocaleTimeString("ro-RO")}`,
        `Message: ${error.message}`,
      ];
      if (error.status) lines.push(`Status: ${error.status}`);
      if (error.url) lines.push(`URL: ${error.url}`);
      if (error.detail) lines.push(`Stack:\n${error.detail}`);
      return lines.join("\n");
    }).join("\n\n---\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid #1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0d0d0d",
        flexShrink: 0,
      }}>
        <span style={{ color: "#d4d4d4", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>
          Erori detectate <span style={{ color: "#ef4444" }}>({errors.length})</span>
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleCopyAll}
            style={{ ...adminBtnStyle, ...(copied ? { borderColor: "#16a34a", color: "#4ade80" } : {}) }}
          >
            {copied ? "Copiat ✓" : "Copiază tot"}
          </button>
          <button onClick={onClear} style={adminBtnStyle}>Golește</button>
          <button onClick={onClose} style={adminBtnStyle}>✕</button>
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, fontFamily: "monospace" }}>
        {errors.map(error => {
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
                  <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>{error.status}</span>
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
                  maxHeight: 110,
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
        })}
      </div>
    </>
  );
}

const adminBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #222",
  borderRadius: 5,
  color: "#555",
  fontSize: 11,
  cursor: "pointer",
  padding: "2px 8px",
};
