import { useState, useEffect, useRef } from "react";
import { useErrorMonitor, type ErrorEntry } from "../providers/ErrorMonitorContext";
import useAuth from "../auth/useAuth";

const WHATSAPP_NUMBER = "40745469907";

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

  if (count === 0) return null;

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
            {auth.authorise ? (
              <AdminPanel errors={errors} onClear={clearErrors} onClose={() => setOpen(false)} />
            ) : (
              <ClientPanel onDismiss={() => { clearErrors(); setOpen(false); }} />
            )}
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

function ClientPanel({ onDismiss }: { onDismiss: () => void }) {
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Bună ziua, am întâmpinat o eroare pe site.")}`;

  return (
    <div style={{ padding: "24px 20px", color: "#d4d4d4" }}>
      <div style={{ fontSize: 30, marginBottom: 12, textAlign: "center" }}>⚠️</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#fff", textAlign: "center" }}>
        A apărut o eroare
      </div>
      <div style={{
        fontSize: 12,
        color: "#888",
        lineHeight: 1.7,
        marginBottom: 20,
        textAlign: "center",
      }}>
        Faceți poză la ecran cu această eroare și trimiteți vă rog la ancavisuals
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "11px 16px",
          background: "#25D366",
          border: "none",
          borderRadius: 8,
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          textDecoration: "none",
          marginBottom: 10,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Trimite pe WhatsApp
      </a>

      <button
        onClick={onDismiss}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 16px",
          background: "transparent",
          border: "1px solid #222",
          borderRadius: 7,
          color: "#555",
          fontSize: 12,
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        Ignoră
      </button>
    </div>
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
